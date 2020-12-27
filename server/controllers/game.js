
const Game = require("../models/Game");
const SecurityLayer = require("../services/SecurityLayer")

const createGame = async (req, res) => {
    const {
        public,
        name,
    } = req.body;

    const game = new Game({
        public,
        name,
    });

    await game.save();
    res.json({
        hash: SecurityLayer.getHashByGame(game),
        item: game
    })
}

const getGame = async (req, res) => {
    const { id } = req.params;
    const game = await Game.findById(id);
    // здесь может быть проверка, есть ли у пользователя доступ к игре
    res.json({
        item: game
    });
}

const getGames = async (req, res) => {
    const games = await Game.find();
    res.json({
        items: games
    });
}


const getItem = async (req, res) => {
    let game = await Game.findOne();
    // @fixme
    if (!game) {
        game = new Game({
            name: "Dev"
        })
        await game.save();
    }
    res.json({
        item: game
    })
}

const createRedLogicLine = async (req, res) => {
    const { sourceTurnId, sourceMarker, targetTurnId, targetMarker } = req.body;
    const game = await Game.findOne();
    game.redLogicLines = [
        { sourceTurnId, sourceMarker, targetTurnId, targetMarker },
        ...game.redLogicLines
    ];
    await game.save();
    res.json({ item: game.redLogicLines[0] })
}

const updateRedLogicLines = async (req, res) => {
    const { redLogicLines } = req.body;
    // console.log(redLogicLines);
    const game = await Game.findOne();
    // @fixme
    // if (!game) {
    //     game = new Game({
    //         name: "Dev"
    //     })
    //     await game.save();
    // }
    game.redLogicLines = redLogicLines;
    await game.save();
    res.json({ item: game });    // нейтральное название "item" (payload)
}

const deleteRedLogicLines = async (req, res) => {
    const { redLogicLines } = req.body;
    // console.log(redLogicLines);
    const game = await Game.findOne();
    // @todo: O(n^2) заменить на O(n)
    const length = game.redLogicLines.length
    game.redLogicLines = game.redLogicLines.filter(line => {
        for (let redLogicLineToRemove of redLogicLines) {
            if (line._id == redLogicLineToRemove._id) {
                return false;
            }
        }
        return true
    })
    await game.save();

    res.json({
        item: game
    })
}

module.exports = {
    createGame,
    getItem,
    updateRedLogicLines,
    createRedLogicLine,
    deleteRedLogicLines,
    getGame,
    getGames
};











