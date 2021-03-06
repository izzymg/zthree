const KoaRouter = require("koa-router");
const config = require("../../config/config");
const middleware = require("./middleware");
const models = require("../models");

const router = new KoaRouter({
  prefix: "/reports",
});

router.get("/",
  async function getLevels(ctx) {
    ctx.body = await models.report.getLevels();
  }
);

router.get("/:board",
  async function getBoardReports(ctx) {
    await middleware.requireBoardModerator(ctx.params.board)(ctx);
    const page = parseInt(ctx.query.page) || 1;
    const limit = parseInt(ctx.query.limit) || 10;
    ctx.body = await models.report.getPageOnBoard(
      ctx.params.board, limit || 25, page
    );
  }
);

router.post("/:number",
  async function createReport(ctx) {
    const number = parseInt(ctx.params.number);
    const board = ctx.query.board;
    ctx.assert(number && board, 400);

    const lastReport = await models.ip.getLastReport(ctx.ip);
    if(lastReport && lastReport + config.posts.reportCooldown > Date.now()) {
      ctx.throw(400, "Please wait before you do that again");
    }
    const postUid = await models.post.getUid(board, number);
    ctx.assert(postUid, 404, "No post found");
    const reportLevel = parseInt(ctx.query.level);
    ctx.assert(!isNaN(reportLevel), 400, "Invalid report level");
    await models.report.insert({
      level: reportLevel,
      postUid,
      ip: ctx.ip,
    });
    await models.ip.setLastReport(ctx.ip, Date.now());
    ctx.body = "Post reported";
  }
);

module.exports = router.routes();