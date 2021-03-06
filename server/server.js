require('dotenv').config();
require('./models/db');
const cors = require('cors');
const path = require('path');

let express = require('express');
const turnsController = require('./controllers/turns');
const gameClassesController = require('./controllers/gameClasses');
const gameController = require('./controllers/game');
const authController = require('./controllers/auth');
const User = require('./models/User');
const SecurityLayer = require('./services/SecurityLayer');
let app = express();
const { USER_MODE_ADMIN, USER_MODE_VISITOR } = User.user_modes;

const port = process.env.PORT || 3000;
const mode = process.env.USER_MODE || USER_MODE_VISITOR; // может быть ADMIN, VISITOR, PLAYER, ...

let jsonParser = express.json();

const gameMiddleware = async (req, res, next) => {
  const { hash } = req.query; // после request?...
  const { gameId, userId, roles } = await SecurityLayer.getInfo(hash);
  if (!gameId) {
    // @todo: вынести в отдельный тип ошибок
    const error = new Error('Игра не найдена');
    error.statusCode = 404;
    return next(error);
  }
  req.gameInfo = { gameId, userId, roles };
  next(); // пропускаем в следующий слой
};

const rulesCanView = async (req, res, next) => {
  // gameId - могут ли редактировать все
  if (req.gameInfo.roles.indexOf(User.roles.ROLE_VIEW) === -1) {
    const error = new Error('Просмотр не доступен');
    error.statusCode = 403;
    return next(error);
  }
  next();
};

const rulesCanEdit = async (req, res, next) => {
  // gameId - могут ли редактировать все
  if (req.gameInfo.roles.indexOf(User.roles.ROLE_EDIT) === -1) {
    const error = new Error('Редактирование не доступно');
    error.statusCode = 403;
    return next(error);
  }
  next();
};

app.use(cors());

app.use('/public', express.static(path.join(__dirname, 'public'))); // загружает index.html
// нужна для скриншотов minimap
app.use(jsonParser);

app.post('/login', authController.login);
app.get('/codes/login/:hash', authController.codeLogin);

app.get('/games', authController.adminMiddleware, gameController.getGames);

app.post('/games', gameController.createGame);
// if (mode == USER_MODE_ADMIN) {
app.put(
  '/game',
  gameMiddleware, // проверяет что в адресе есть hash, находит игру и права юзера и права в этой игре
  authController.adminMiddleware, // проверяет является ли юзер superAdmin
  gameController.editGame
); // требует privilege elevation
app.delete(
  '/game',
  gameMiddleware,
  authController.adminMiddleware,
  gameController.deleteGame
); // требует privilege elevation
// }

app.get('/game', gameMiddleware, rulesCanView, gameController.getGame);

app.put(
  '/game/red-logic-lines',
  gameMiddleware,
  rulesCanView,
  gameController.updateRedLogicLines
); // camelCase в endpoints не используют
app.post(
  '/game/red-logic-lines',
  gameMiddleware,
  rulesCanEdit,
  gameController.createRedLogicLine
);
app.delete(
  '/game/red-logic-lines',
  gameMiddleware,
  rulesCanEdit,
  gameController.deleteRedLogicLines
);

app.post(
  '/codes',
  gameMiddleware,
  authController.adminMiddleware,
  gameController.addCode
);

app.get(
  '/game-classes',
  gameMiddleware,
  rulesCanView,
  gameClassesController.getGameClasses
);
app.get(
  '/game-classes/:id',
  gameMiddleware,
  rulesCanEdit,
  gameClassesController.getGameClass
);
app.post(
  '/game-classes',
  gameMiddleware,
  rulesCanEdit,
  gameClassesController.createGameClass
);
app.put(
  '/game-classes/:id',
  gameMiddleware,
  rulesCanEdit,
  gameClassesController.updateGameClass
);
app.delete(
  '/game-classes/:id',
  gameMiddleware,
  rulesCanEdit,
  gameClassesController.deleteGameClass
);

app.get('/turns', gameMiddleware, rulesCanView, turnsController.getTurns);
app.post('/turns', gameMiddleware, rulesCanEdit, turnsController.saveTurn);
app.put(
  '/turns/coordinates',
  gameMiddleware,
  rulesCanEdit,
  turnsController.updateCoordinates
);
app.put('/turns/:id', gameMiddleware, rulesCanEdit, turnsController.updateTurn);
app.delete(
  '/turns/:id',
  gameMiddleware,
  rulesCanEdit,
  turnsController.deleteTurn
);

app.use('*', (req, res) => {
  res.status(404).json({
    message: '404 Not Found',
  });
});

app.use((err, req, res, next) => {
  const { statusCode = 500, message } = err;
  console.log({ err });
  res.status(statusCode).send({
    // проверяем статус и выставляем сообщение в зависимости от него
    message: statusCode === 500 ? 'На сервере произошла ошибка' : message,
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
