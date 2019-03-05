const persistence = require("./persistence");
const config = require("../config/config");
const path = require("path");
const fs = require("../libs/fs");


function lengthCheck(str, max, name) {
  str = str.replace(/\r\n/, "\n");
  if (!str) {
    return null;
  }
  if (typeof str !== "string") {
    return `${name}: expected string.`;
  }

  str = str.trim();
  if (str.length > max) {
    return `${name} must be under ${max} characters.`;
  }

  if (!str) {
    return null;
  }

  return null;
}

function sanitize(str) {
  str = str.trim();
  if (!str) {
    return null;
  }
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`/g, "&#96;")
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/\n/g, "<br>")
    .replace(/(<br>){2,}/g, "<br><br>");
}

function formatPostContent(str) {
  if (!str || typeof str !== "string") {
    return null;
  }
  str = str.replace(/&gt;&gt;([0-9]*)\/([0-9]*)/gm, 
    "<a class='quotelink' data-id='$2' href='../threads/$2#$3'>>>$2/$3</a>"
  );
  str = str.replace(/&gt;&gt;([0-9]*)/gm, 
    "<a class='quotelink' data-id='$1' href='#$1'>>>$1</a>"
  );
  str = str.replace(/^&gt;(.*)/gm, "<span class='quote'>$1</span>");
  return str;
}

/**
 * @typedef {object} DbPost
 * @property {number} uid
 * @property {number} id
 * @property {string} boardUrl
 * @property {number} parent
 * @property {Date} lastBump
 * @property {string} name
 * @property {string} subject
 * @property {string} content
 * @property {boolean} sticky
 * @property {string} ip
 * @property {Array<UserFile>} files
*/


const Post = exports.Post = function(
  { postId, boardUrl, uid, parent, createdAt,
    lastBump, name, subject, 
    content, sticky, ip, files = [] }, { fresh } = {  fresh: false }) {
  
  const post = {
    ip,
    boardUrl,
    parent: parent || 0,
    createdAt: createdAt || new Date(Date.now()),
    lastBump: lastBump || parent == 0 ? new Date(Date.now()) : null,
    name: name || "Anonymous",
    subject,
    content,
    sticky: sticky || false,
    files
  };
  if(!fresh) {
    post.uid = uid;
    post.id = postId;
  }
  return post;
};

/**
 * @typedef UserFile
 * @property {number} postUid
 * @property {string} filename
 * @property {string} thumbFilename
 * @property {string} mimetype
 * @property {string} originalName
 * @property {number} size
 * @property {string} hash
 * @property {string} tempPath
 */

const File = exports.File = function({ postUid, filename, thumbFilename,
  mimetype, originalName, size, hash, tempPath }, { fresh } = { fresh: false }) {
  const file = {
    filename,
    thumbFilename,
    mimetype,
    originalName: originalName || "image.png",
    size,
    hash
  };
  if(!fresh) {
    file.postUid = postUid;
  } else {
    file.tempPath = tempPath;
  }
  return file;
};

/**
 * 
 * @returns {Array<DbPost>}
 */
const FilePosts = function(rows) {
  let lastPost = null;
  let posts = [];
  rows.forEach((row) => {
    // Push row file data onto already existent post
    if(row.filename && lastPost && lastPost.id == row.postId) {
      lastPost.files.push(File(row));
      return;
    }
    const post = Post(row);
    if(row.filename) post.files.push(File(row));
    lastPost = post;
    posts.push(post);
  });
  return posts;
};

/**
 * 
 * @returns {DbPost} 
 */
const FilePost = function(rows) {
  const post = Post(rows[0].posts);
  if(rows[0].files) post.files = rows.map((row) => File(row.files));
  return post;
};

exports.getPost = async function(board, id) {
  const sql = 
    `SELECT createdAt, name, subject, content, sticky, parent,
      lastBump, filename, thumbFilename, originalName, mimetype, size
      FROM posts LEFT JOIN files on files.postUid = posts.uid
      WHERE boardUrl = ? AND postId = ?`;
  const rows = await persistence.db.getAll({ sql, values: [board, id], nestTables: true });
  if(!rows) return null;
  return FilePost(rows);
};

exports.getThreads = async function(board) {
  const sql = 
    `SELECT postId, createdAt, name, subject, content, sticky, lastBump,
      filename, thumbFilename, originalName, mimetype, size
      FROM posts LEFT JOIN files ON files.postUid = posts.uid
      WHERE boardUrl = ? AND parent = 0
      ORDER BY sticky DESC, lastBump DESC`;
  const rows = await persistence.db.getAll({ sql, values: [board], nestTables: false });
  if(!rows) return null;
  return FilePosts(rows);
};

exports.getThread = async function(board, id) {
  const sql =
    `SELECT postId, createdAt, name, subject, content, sticky, lastBump, 
      filename, thumbFilename, originalName, mimetype, size
      FROM posts LEFT JOIN files ON files.postUid = posts.uid
      WHERE parent = 0 AND boardUrl = ? AND postId = ?`;
  const rows = await persistence.db.getAll({ sql, values: [board, id], nestTables: true});
  if(!rows) return null;
  return FilePost(rows);
};

exports.getReplies = async function(board, threadId) {
  const sql = 
    `SELECT postId, createdAt, name, subject, content, sticky,
      filename, thumbFilename, originalName, mimetype, size
      FROM posts LEFT JOIN files ON files.postUid = posts.uid
      WHERE boardUrl = ? AND parent = ?
      ORDER BY createdAt ASC`;
  const rows = await persistence.db.getAll({ sql, values: [board, threadId], nestTables: false});
  if(!rows) return null;
  return FilePosts(rows);
};


exports.getThreadCount = async function(board) {
  const num = await persistence.db.getOne({
    sql: "SELECT COUNT(uid) AS count FROM posts WHERE boardUrl = ? AND parent = 0",
    values: [board]
  });
  if(!num || !num.count) return 0;
  return num.count;
};

exports.getReplyCount = async function(board, id) {
  const num = await persistence.db.getOne({
    sql: "SELECT COUNT(uid) AS count FROM posts WHERE boardUrl = ? AND parent = ?",
    values: [board, id]
  });
  if(!num || !num.count) return 0;
  return num.count;
};

exports.getOldestThreadId = async function(board) {
  const oldest = await persistence.db.getOne({
    sql: `SELECT postId as id FROM posts WHERE parent = 0 AND boardUrl = ? AND sticky = false
            ORDER BY lastBump ASC LIMIT 1;`,
    values: [board]
  });
  if(!oldest) return null;
  return oldest.id;
};

exports.bumpPost = async function(board, id) {
  const res = await persistence.db.query({
    sql: "UPDATE posts SET lastBump = ? WHERE boardUrl = ? AND parent = 0 AND postId = ?",
    values: [new Date(Date.now()), board, id]
  });
  if (!res || !res.affectedRows) {
    throw "Bump failed";
  }
  return res.affectedRows;
};

/**
 * @param {DbPost} post
 */
exports.savePost = async function(post) {
  let processedFiles = 0;
  const validationError = (message) => ({ status: 400, message });

  let lengthError = null;
  lengthError = lengthCheck(post.name, config.posts.maxNameLength, "Name") || lengthError;
  lengthError = lengthCheck(post.subject, config.posts.maxSubjectLength, "Subject") || lengthError;
  lengthError = lengthCheck(post.content, config.posts.maxContentLength, "Content") || lengthError;
  if(lengthError) throw validationError(lengthError);


  post.name = sanitize(post.name);
  post.subject = sanitize(post.subject);
  post.content = formatPostContent(sanitize(post.content));

  if(post.parent) {
    if(config.posts.replies.requireContentOrFiles && (!post.files) && !post.content) {
      throw validationError("Content or file required");
    }
  } else {
    if(config.posts.threads.requireContent && !post.content) {
      throw validationError("Content required");
    }
    if(config.posts.threads.requireSubject && !post.subject) {
      throw validationError("Subject required");
    }
    if(config.posts.threads.requireFiles && (!post.files)) {
      throw validationError("File required");
    }
  }

  const postFiles = post.files;
  delete post.files;
  const dbConnecton = await persistence.db.getConnection();
  try {
    await dbConnecton.beginTransaction();

    const insertedPost = await dbConnecton.query({
      sql: `INSERT INTO posts
            SET postId = (SELECT id FROM boardids WHERE boardUrl = ? FOR UPDATE), ?`,
      values: [post.boardUrl, post]
    });
    await dbConnecton.query({ 
      sql: "UPDATE boardids SET id = id + 1 WHERE boardUrl = ?",
      values: [post.boardUrl]
    });

    if(!insertedPost.insertId) throw new Error("Failed to insert post into DB");
    if(postFiles) {
      await Promise.all(postFiles.map(async(userFile) => {
        // Copy temp store to permanent
        await fs.copy(
          userFile.tempPath,
          path.join(config.posts.filesDir, userFile.filename)
        );
        // Create thumbnail on image mimetypes
        if(userFile.thumbFilename) {
          await fs.createThumbnail(
            path.join(config.posts.filesDir, userFile.filename),
            path.join(config.posts.filesDir, userFile.thumbFilename),
            config.posts.thumbWidth
          );
        }
        delete userFile.tempPath;
        userFile.originalName = sanitize(userFile.originalName);
        // Save to db
        await dbConnecton.query({
          sql: "INSERT INTO files SET postUId = ?, ?",
          values: [insertedPost.insertId, userFile]
        });
        processedFiles++;
      }));
    }
    await dbConnecton.commit();
  } catch(error) {
    dbConnecton.rollback();
    throw new Error(error);
  } finally {
    dbConnecton.release();
  }
  return { processedFiles };
};

exports.deletePost = async(board, id) => {
  const files = await persistence.db.getAll({
    sql: `SELECT filename, thumbFilename
          FROM files INNER JOIN posts ON files.postUid = posts.uid
          WHERE boardUrl = ? AND (postId = ? OR parent = ?)`,
    values: [board, id, id]}
  );
  let deletedFiles = 0;
  if (files && files.length > 0) {
    await Promise.all(files.map(async(file) => {
      await fs.unlink(
        path.join(config.posts.filesDir, file.filename)
      );
      if (file.thumbFilename) {
        await fs.unlink(
          path.join(config.posts.filesDir, file.thumbFilename)
        );
      }
      deletedFiles++;
    }));
  }
  const { affectedRows } = await persistence.db.query({
    sql: `DELETE posts, files FROM posts
          LEFT JOIN files ON files.postUid = posts.uid
          WHERE boardUrl = ? AND (postId = ? OR parent = ?)`,
    values: [board, id, id]
  });
  return { deletedPosts: affectedRows, deletedFiles };
};
