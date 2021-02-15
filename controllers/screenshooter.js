const selenium = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const chromedriver = require('chromedriver');
const _fs = require('fs');
const fs = _fs.promises;
const path = require('path');
const SecurityLayer = require('../services/SecurityLayer');

const images = require('images');

const chromeOpts = new chrome.Options();
chromeOpts.addArguments(
  `user-data-dir=${path.resolve(
    path.join(__dirname, '..', 'selenium', 'cache')
  )}`
);

// console.log(chromeOpts);

chrome.setDefaultService(
  new chrome.ServiceBuilder(chromedriver.path, chromeOpts).build()
);

const seleniumCapabilities = {
  os_version: '10',
  resolution: '1920x1080',
  browserName: 'Chrome',
  os: 'Windows',
  name: 'screenshooter',
  build: 'none',
  'browserstack.user': 'USERNAME',
  'browserstack.key': 'TOCKEN',
};

async function sleep(time) {
  return new Promise((res, rej) => {
    setTimeout(res, time);
  });
}

const ZOOM_FACTOR = 10;
const PATH4SCREENS = path.join(__dirname, '..', 'public');

async function getScreenshot(gameId) {
  try {
    const driver = new selenium.Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOpts.headless())
      .withCapabilities(selenium.Capabilities.chrome())
      .build();
    try {
      if (!_fs.existsSync(PATH4SCREENS)) {
        await fs.mkdir(PATH4SCREENS, {recursive: true})
      }

      const gameHash = SecurityLayer.hashFunc(
        gameId,
        process.env.GAME_ID_HASH_LENGTH
      );
      const gameUrl = `http://localhost:3001/game?hash=${gameHash.substr(0,3)}`;
      console.log(gameUrl);
      await driver.get(gameUrl);
      //await sleep(5000);
      await driver.wait(async function () {
        const state = await driver.executeScript('return document.readyState');
        if (state === 'complete') {
          return true;
        } else {
          return false;
        }
      });
      await driver.wait(async function () {
        await driver.executeScript(`document.body.style.zoom = '${100/ZOOM_FACTOR}%';`);
        const gfw = await driver.executeScript(
          `return document.getElementsByClassName('gameFieldWrapper').length`
        );
        if (!gfw) return gfw;
        await driver.executeScript(
          `document.getElementsByClassName('gameFieldWrapper')[0].style.height = '${100*ZOOM_FACTOR}vh'`
        );
        return true;
      });
      await driver.wait(async function () {
        const state = await driver.executeScript(
          `return window[Symbol.for('MyIsLoaded')]`
        );
        // console.log(state);
        return state === 0;
      }, 30000);
      const divs_with_errors = await driver.executeScript(
        `return (${func2hideOverflow.toString()})()`
      );
      console.error(`divs_with_errors = ${JSON.stringify(divs_with_errors)}`);
      const mapSize = await driver.executeScript(
        `return (${funcGetFieldSize.toString()})()`
      );
      console.log(`mapSize: ${JSON.stringify(mapSize)}`);
      const windowSize = await driver.executeScript(
        `const cstyle = window.getComputedStyle(document.getElementsByClassName('gameFieldWrapper')[0]);
          return {
            'block-size': cstyle['block-size'],
            'inline-size': cstyle['inline-size']
          };
        `
      );
      console.log(`windowSize: ${JSON.stringify(windowSize)}`);

      const files = await fs.readdir(path.join(PATH4SCREENS));
      console.log(files);
      for (const ent of files) {
        await fs.rm(path.join(PATH4SCREENS, ent));
      }

      const imgPaths = await funcRunOverTheField(driver, mapSize, windowSize);
      
      const maxi = imgPaths.reduce((acc, it) => {return (acc > it.i ? acc : it.i);}, 0);
      const maxj = imgPaths.reduce((acc, it) => {return (acc > it.j ? acc : it.j);}, 0);
      if (!(maxi >= 1 && maxj >= 1)) {
        throw new Error(`${JSON.stringify({maxi, maxj})}`);
      }
      const imgArr = new Array(maxi).fill(new Array(maxj).fill({}));
      for (const img of imgPaths) {
        imgArr[img.i][img.j] = {path: img.path4img};
      }
      for (let i = 0; i < maxi; i++) {
        for (let j = 0; j < maxj; j++) {
          const img =  images(imgArr[i][j].path);
          imgArr[i][j] = {...(imgArr[i][j]), img, w: img.width(), h: img.height()};
        }
      }

      const mmSize = imgArr[0].reduce((acc, it) => ({w: acc.w + it.w, h: acc.h + it.h}), {w: 0, h: 0});

      const mm = images(minimap.w, minimap.h);
      let curY = 0;
      for (const row of imgArr) {
        let curX = 0;
        let maxY = 0;
        for (const imgDsc of row) {
          mm.draw(imgDsc.img, curX, curY);
          curX += imgDsc.w;
          maxY = (maxY > imgDsc.h ? maxY : imgDsc.h);
        }
        curY += maxY;
      }

      mm.save(path.join(PATH4SCREENS, `output.png`));
        

      driver.quit();
    } catch (err) {
      console.error(err);
      driver.quit();
    }
  } catch (err) {
    console.error(err);
  }
}

async function funcRunOverTheField (driver, {left, top, right, bottom}, winsize) {
  const funcMoveField = async function(left, top) {
    const gf = window[Symbol.for('MyGame')].gameField;
    gf.stageEl.css('left', `${-left}px`);
    gf.stageEl.css('top', `${-top}px`);
    gf.saveFieldSettings({
      left,
      top,
      height: 1000,
      width: 1000,
    });
    await gf.triggers.dispatch('RECALCULATE_FIELD');
    await gf.triggers.dispatch('DRAW_LINES');
  };
  const funcTakeScreen = async function(i,j) {
    const fieldCoords = await driver.executeScript(`return await (${funcGetFieldSize.toString()})();`);
    console.log(`funcTakeScreen: fieldCoords: ${JSON.stringify(fieldCoords)}`);
    const data = await driver.takeScreenshot();
    const base64Data = data.replace(/^data:image\/png;base64,/, '');
    const path4img = path.resolve(
      path.join(PATH4SCREENS, `out_${i}_${j}.png`)
    );
    await fs.writeFile(path4img, base64Data, 'base64');
    console.log(`i: ${i}, j: ${j}: done`);
    return {i, j, path4img};
  };
  const imgPaths = [];
  await driver.executeScript(`await (${funcMoveField.toString()})(${left}, ${top});`);
  console.log("after the first move");
  let xAim = right - left;
  let yAim = bottom - top;
  console.log(`xAim: ${xAim}, yAim: ${yAim}`);
  let i = 0;
  let wstep = winsize['inline-size'];
  wstep = +wstep.substr(0, wstep.length -2);
  let hstep = winsize['block-size'];
  hstep = +hstep.substr(0, hstep.length -2);
  console.log(`{wstep: ${wstep}, hstep: ${hstep}}`);
  let h = 0;
  let w = 0;
  for (; h < yAim; h += hstep) {
    let j = 0;
    w = 0;
    imgPaths.push(await funcTakeScreen(i,j));
    w += wstep;
    j++;
    for (; w < xAim; w += wstep) {
      await driver.executeScript(`await (${funcMoveField.toString()})(${wstep},0)`);
      imgPaths.push(await funcTakeScreen(i,j));
      j++;
    }
    await driver.executeScript(`await (${funcMoveField.toString()})(${-(w-wstep)},${hstep})`);
    i++;
    console.log(`after a cycle: h: ${h}, w: ${w}`);
  }
  console.log(`after all: h: ${h}, w: ${w}`);
  return imgPaths;
};


function funcGetFieldSize() {
  const turns = window[Symbol.for('MyGame')].turnCollection.getTurns();
  const mapSize = turns.reduce((acc, it) => {
    const pos = it.getPositionInfo();
    if (!acc) {
      return {
        left: pos.x,
        right: pos.x + pos.width,
        top: pos.y,
        bottom: pos.y + pos.height,
      };
    } else {
      return {
        left: acc.left < pos.x ? acc.left : pos.x,
        top: acc.top < pos.y ? acc.top : pos.y,
        right:
          acc.right > pos.x + pos.width ? acc.right : pos.x + pos.width,
        bottom:
          acc.bottom > pos.y + pos.height ? acc.bottom : pos.y + pos.height,
      };
    }
  });
  return mapSize;
};

function func2hideOverflow() {
  return [...document.getElementsByClassName('paragraphText')]
    .map((it, i) => {
      if (it) {
        it.style.overflow = 'hidden';
        return false;
      } else {
        return { ind: i, val: it };
      }
    })
    .filter((it) => it);
};


module.exports = {
  getScreenshot,
};