"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.Recurrence = exports.Role = exports.PrismaClient = void 0;
var client_1 = require("./generated/client/client");
Object.defineProperty(exports, "PrismaClient", { enumerable: true, get: function () { return client_1.PrismaClient; } });
Object.defineProperty(exports, "Role", { enumerable: true, get: function () { return client_1.Role; } });
Object.defineProperty(exports, "Recurrence", { enumerable: true, get: function () { return client_1.Recurrence; } });
var db_1 = require("./db");
Object.defineProperty(exports, "prisma", { enumerable: true, get: function () { return db_1.prisma; } });
