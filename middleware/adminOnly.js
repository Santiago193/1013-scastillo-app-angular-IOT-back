module.exports = function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.sendStatus(403);
  }
  next();
};
