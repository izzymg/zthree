const redis = require("../../database/redis");
const uuid = require("uuid/v4");
const functions = require("./functions");

exports.createCooldown = async (ctx, next) => {
    await redis.hSet(ctx.ip, "cooldown", Date.now() + ctx.state.board.cooldown * 1000);
    await redis.expire(ctx.ip, 24 * 60 * 60);
    return next();
};

exports.checkCooldown = async (ctx, next) => {
    const cd = await redis.hGet(ctx.ip, "cooldown");
    let now = Date.now();
    if (cd && cd < now) {
        await redis.hDel(ctx.ip, "cooldown");
    } else if (cd) {
        return (ctx.body = `You need to wait ${Math.floor(
            (cd - now) / 1000
        )} seconds before posting again`);
    }
    return next();
};

exports.login = async ctx => {
    if (!ctx.fields.username) {
        return ctx.throw(400, "Expected username");
    }
    if (!ctx.fields.password) {
        return ctx.throw(400, "Expected password");
    }

    // Block if > 4 attempts to login
    const attempts = Number(await redis.hGet(ctx.ip, "attempts")) || 0;
    const attemptAge = Number(await redis.hGet(ctx.ip, "attemptAge"));

    // Delete attempts and allow if over 12 hours since last attempt
    if (attemptAge && attemptAge + 12 * 60 * 1000 < Date.now()) {
        await redis.hSet(ctx.ip, "attempts", 1);
        await redis.hSet(ctx.ip, "attemptAge", Date.now());
    } else if (attempts > 5) {
        return (ctx.body = "Too many attempts, please try again later");
    } else {
        // Increment attempts
        await redis.hSet(ctx.ip, "attempts", attempts + 1);
        await redis.hSet(ctx.ip, "attemptAge", Date.now());
    }

    const authenticated = await functions.comparePasswords(
        ctx.fields.username, ctx.fields.password
    );
    if (authenticated) {
        if(ctx.session) {
            await redis.del(ctx.state.session.id);
        }
        const user = await functions.getUser(ctx.fields.username);
        const sessionId = uuid();
        await Promise.all([
            redis.hSet(sessionId, "username", ctx.fields.username),
            redis.hSet(sessionId, "role", user.role),
            redis.expire(sessionId, 60 * 60),
        ]);
        ctx.set("set-cookie", `id=${sessionId}`);
        // Delete attempts when successful
        await redis.hDel(ctx.ip, "attempts");
        await redis.hDel(ctx.ip, "attemptAge");
        return (ctx.body = "Login successful, authenticated");
    }
    return ctx.throw(401, "Incorrect username or password");
};

exports.logout = async ctx => {
    if (ctx.cookies) {
        const sessionId = ctx.cookies.get("id");
        if (sessionId) {
            await redis.del(sessionId);
            return (ctx.body = "Logged out");
        }
    }
    return (ctx.body = "You weren't logged in");
};

exports.checkSession = async (ctx, next) => {
    if (ctx.cookies) {
        const sessionId = ctx.cookies.get("id");
        if (sessionId) {
            const username = await redis.hGet(sessionId, "username");
            const role = await redis.hGet(sessionId, "role");
            if (username && role) {
                ctx.state.session = {
                    id: sessionId,
                    username,
                    role,
                };
                return next();
            }
        }
    }
    return next();
};

exports.render = async ctx => await ctx.render("login");
