"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Role = exports.prisma = exports.PrismaClient = void 0;
var index_js_1 = require("./generated/client/index.js");
Object.defineProperty(exports, "PrismaClient", { enumerable: true, get: function () { return index_js_1.PrismaClient; } });
var db_1 = require("./db");
Object.defineProperty(exports, "prisma", { enumerable: true, get: function () { return db_1.prisma; } });
var index_js_2 = require("./generated/client/index.js");
Object.defineProperty(exports, "Role", { enumerable: true, get: function () { return index_js_2.Role; } });
