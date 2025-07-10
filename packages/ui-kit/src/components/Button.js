"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Button = Button;
var jsx_runtime_1 = require("react/jsx-runtime");
function Button(_a) {
    var children = _a.children;
    return ((0, jsx_runtime_1.jsx)("button", { style: {
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "#ff9e42",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600,
        }, onClick: function () { return alert("Hello from UI-Kit!"); }, children: children }));
}
