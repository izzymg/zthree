-- Fantasy SQL schema

----------------------------------------------------------------------
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boards (
    uid             varchar(20) PRIMARY KEY,
    title           tinytext NOT NULL,
    about           text,
    sfw             boolean DEFAULT true,
    bumpLimit       integer DEFAULT 200,
    fileLimit      integer DEFAULT 200,
    maxThreads      integer DEFAULT 30,
    cooldown        smallint DEFAULT 60,
    createdAt       datetime DEFAULT now()
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

----------------------------------------------------------------------
----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS postnumbers (
    boardUid        varchar(20),
    number          integer NOT NULL DEFAULT 1,
    CONSTRAINT postnumberboard
        FOREIGN KEY (boardUid) REFERENCES boards (uid)
        ON DELETE CASCADE
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TRIGGER newboard AFTER INSERT ON boards
    FOR EACH ROW
    INSERT INTO postnumbers SET boardUid = new.uid;

CREATE TABLE IF NOT EXISTS posts (
    uid             integer PRIMARY KEY AUTO_INCREMENT,
    number          integer,
    boardUid        varchar(20) NOT NULL,
    parent          integer NOT NULL DEFAULT 0,
    createdAt       datetime NOT NULL DEFAULT now(),
    lastBump        datetime,
    name            text,
    subject         text,
    content         text,
    sticky          boolean DEFAULT false,
    locked          boolean DEFAULT false,
    ip              varchar(39),
    CONSTRAINT postboard
        FOREIGN KEY (boardUid) REFERENCES boards (uid)
        ON DELETE CASCADE,
    UNIQUE KEY boardpost (boardUid, number)
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS postUid ON posts (uid);
CREATE INDEX IF NOT EXISTS postBoardUid ON posts (boardUid);
----------------------------------------------------------------------
----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS files (
    postUid         integer NOT NULL,
    filename        varchar(100) PRIMARY KEY,
    mimetype        tinytext,
    originalName    text,
    size            integer,
    hash            text,
    CONSTRAINT filepost
        FOREIGN KEY (postUid) REFERENCES posts (uid)
        ON DELETE CASCADE
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS filePostUid ON files (postUid);

----------------------------------------------------------------------
----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bans (
    uid             integer PRIMARY KEY AUTO_INCREMENT,
    ip              varchar(39) NOT NULL,
    boardUid        varchar(20) NOT NULL,
    allBoards       boolean DEFAULT FALSE,
    expires         datetime,
    reason          text,
    constraint banboard
        FOREIGN KEY (boardUid) REFERENCES boards (uid)
        ON DELETE CASCADE
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS banIp ON bans (ip);

----------------------------------------------------------------------
----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    username        varchar(100) PRIMARY KEY,
    password        text,
    createdAt       datetime DEFAULT now()
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

----------------------------------------------------------------------
----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS administrators (
    username        varchar(100) UNIQUE,
    createdAt       datetime NOT NULL DEFAULT now(),
    CONSTRAINT adminuser
        FOREIGN KEY (username) REFERENCES users (username)
        ON DELETE CASCADE
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

----------------------------------------------------------------------
----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS moderators (
    username        varchar(100) NOT NULL,
    boardUid        varchar(20) NOT NULL,
    createdAt       datetime NOT NULL DEFAULT now(),
    CONSTRAINT moduser
        FOREIGN KEY (username) REFERENCES users (username)
        ON DELETE CASCADE,
    CONSTRAINT modboard
        FOREIGN KEY (boardUid) REFERENCES boards (uid)
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

----------------------------------------------------------------------
----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reportlevels(
    level           integer PRIMARY KEY,
    description     text
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reports (
    postUid         integer NOT NULL,
    level           integer NOT NULL,
    ip              varchar(29) NOT NULL,
    createdAt       datetime DEFAULT now(),
    CONSTRAINT reportpost
        FOREIGN KEY (postUid) REFERENCES posts (uid)
        ON DELETE CASCADE,
    CONSTRAINT reportlevel
        FOREIGN KEY (level) REFERENCES reportlevels (level)
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

----------------------------------------------------------------------
----------------------------------------------------------------------