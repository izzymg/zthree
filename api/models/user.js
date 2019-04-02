const connection = require("../db/connection");

/**
 * @typedef User
 * @property {string} username Username
 * @property {string} password Password hash
 * @property {Date} createdAt User created at
 */

/**
* @returns { User } 
*/
async function get(username) {
  const [user] = await connection.db.execute({
    sql: "SELECT username, createdAt FROM users WHERE username = ?",
    values: [username],
  });
  if(!user || user.length < 1) return null;
  return user[0];
}

async function update(username, { newUsername, newPassword }) {
  await connection.db.query({
    sql: "UPDATE users SET ? WHERE username = ?",
    values: [{ username: newUsername, password: newPassword }, username],
  });
}

/**
 * @param { User } user 
 */
async function create(user) {
  await connection.db.query({
    sql: "INSERT INTO users SET ?",
    values: [user],
  });
}

async function remove(username) {
  const [{ affectedRows }] = await connection.db.query({
    sql: "DELETE FROM users WHERE username = ?",
    values: [username],
  });
  return { usersRemoved: affectedRows };
}

async function getPassword(username) {
  const [user] = await connection.db.execute({
    sql: "SELECT password FROM users WHERE username = ?",
    values: [username],
  });
  if(!user || user.length < 1) return null;
  return user[0].password;
}

async function canModerateBoard(boardUid, username) {
  // Union administrators incase user has admin privileges
  const [res] = await connection.db.execute({
    sql: `SELECT username, createdAt FROM moderators WHERE boardUid = ? AND username = ?
      UNION
      SELECT username, createdAt FROM administrators WHERE username = ?`,
    values: [boardUid, username, username],
  });
  if(res && res.length > 0 && res[0].createdAt) return true;
  return false;
}

async function isAdmin(username) {
  const [res] = await connection.db.execute({
    sql: "SELECT username, createdAt FROM administrators WHERE username = ?",
    values: [username],
  });
  if(res && res.length > 0 && res[0].createdAt) return true;
  return false;
}

async function makeAdmin(username) {
  await connection.db.query({
    sql: "INSERT INTO administrators SET username = ?",
    values: [username],
  });
}

module.exports = {
  get,
  update,
  create,
  remove,
  getPassword,
  canModerateBoard,
  isAdmin,
  makeAdmin,
};