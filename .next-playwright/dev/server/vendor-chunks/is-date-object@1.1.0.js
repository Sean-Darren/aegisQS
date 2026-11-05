"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/is-date-object@1.1.0";
exports.ids = ["vendor-chunks/is-date-object@1.1.0"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/is-date-object@1.1.0/node_modules/is-date-object/index.js":
/*!**************************************************************************************!*\
  !*** ./node_modules/.pnpm/is-date-object@1.1.0/node_modules/is-date-object/index.js ***!
  \**************************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("\n\nvar callBound = __webpack_require__(/*! call-bound */ \"(ssr)/./node_modules/.pnpm/call-bound@1.0.4/node_modules/call-bound/index.js\");\n\nvar getDay = callBound('Date.prototype.getDay');\n/** @type {import('.')} */\nvar tryDateObject = function tryDateGetDayCall(value) {\n\ttry {\n\t\tgetDay(value);\n\t\treturn true;\n\t} catch (e) {\n\t\treturn false;\n\t}\n};\n\n/** @type {(value: unknown) => string} */\nvar toStr = callBound('Object.prototype.toString');\nvar dateClass = '[object Date]';\nvar hasToStringTag = __webpack_require__(/*! has-tostringtag/shams */ \"(ssr)/./node_modules/.pnpm/has-tostringtag@1.0.2/node_modules/has-tostringtag/shams.js\")();\n\n/** @type {import('.')} */\nmodule.exports = function isDateObject(value) {\n\tif (typeof value !== 'object' || value === null) {\n\t\treturn false;\n\t}\n\treturn hasToStringTag ? tryDateObject(value) : toStr(value) === dateClass;\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vaXMtZGF0ZS1vYmplY3RAMS4xLjAvbm9kZV9tb2R1bGVzL2lzLWRhdGUtb2JqZWN0L2luZGV4LmpzIiwibWFwcGluZ3MiOiJBQUFhOztBQUViLGdCQUFnQixtQkFBTyxDQUFDLGdHQUFZOztBQUVwQztBQUNBLFdBQVcsYUFBYTtBQUN4QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSDtBQUNBO0FBQ0E7O0FBRUEsV0FBVyw0QkFBNEI7QUFDdkM7QUFDQTtBQUNBLHFCQUFxQixtQkFBTyxDQUFDLHFIQUF1Qjs7QUFFcEQsV0FBVyxhQUFhO0FBQ3hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXMiOlsiL1VzZXJzL2dsZW5uamVmZmVyc29uY2hhbmRyYS9BZWdpc1FTL3NvZnR3YXJlL2FlZ2lzUVMvbm9kZV9tb2R1bGVzLy5wbnBtL2lzLWRhdGUtb2JqZWN0QDEuMS4wL25vZGVfbW9kdWxlcy9pcy1kYXRlLW9iamVjdC9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBjYWxsQm91bmQgPSByZXF1aXJlKCdjYWxsLWJvdW5kJyk7XG5cbnZhciBnZXREYXkgPSBjYWxsQm91bmQoJ0RhdGUucHJvdG90eXBlLmdldERheScpO1xuLyoqIEB0eXBlIHtpbXBvcnQoJy4nKX0gKi9cbnZhciB0cnlEYXRlT2JqZWN0ID0gZnVuY3Rpb24gdHJ5RGF0ZUdldERheUNhbGwodmFsdWUpIHtcblx0dHJ5IHtcblx0XHRnZXREYXkodmFsdWUpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59O1xuXG4vKiogQHR5cGUgeyh2YWx1ZTogdW5rbm93bikgPT4gc3RyaW5nfSAqL1xudmFyIHRvU3RyID0gY2FsbEJvdW5kKCdPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nJyk7XG52YXIgZGF0ZUNsYXNzID0gJ1tvYmplY3QgRGF0ZV0nO1xudmFyIGhhc1RvU3RyaW5nVGFnID0gcmVxdWlyZSgnaGFzLXRvc3RyaW5ndGFnL3NoYW1zJykoKTtcblxuLyoqIEB0eXBlIHtpbXBvcnQoJy4nKX0gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNEYXRlT2JqZWN0KHZhbHVlKSB7XG5cdGlmICh0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnIHx8IHZhbHVlID09PSBudWxsKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHJldHVybiBoYXNUb1N0cmluZ1RhZyA/IHRyeURhdGVPYmplY3QodmFsdWUpIDogdG9TdHIodmFsdWUpID09PSBkYXRlQ2xhc3M7XG59O1xuIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/is-date-object@1.1.0/node_modules/is-date-object/index.js\n");

/***/ })

};
;