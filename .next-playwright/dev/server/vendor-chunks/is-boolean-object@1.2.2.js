"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/is-boolean-object@1.2.2";
exports.ids = ["vendor-chunks/is-boolean-object@1.2.2"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/is-boolean-object@1.2.2/node_modules/is-boolean-object/index.js":
/*!********************************************************************************************!*\
  !*** ./node_modules/.pnpm/is-boolean-object@1.2.2/node_modules/is-boolean-object/index.js ***!
  \********************************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("\n\nvar callBound = __webpack_require__(/*! call-bound */ \"(ssr)/./node_modules/.pnpm/call-bound@1.0.4/node_modules/call-bound/index.js\");\nvar $boolToStr = callBound('Boolean.prototype.toString');\nvar $toString = callBound('Object.prototype.toString');\n\n/** @type {import('.')} */\nvar tryBooleanObject = function booleanBrandCheck(value) {\n\ttry {\n\t\t$boolToStr(value);\n\t\treturn true;\n\t} catch (e) {\n\t\treturn false;\n\t}\n};\nvar boolClass = '[object Boolean]';\nvar hasToStringTag = __webpack_require__(/*! has-tostringtag/shams */ \"(ssr)/./node_modules/.pnpm/has-tostringtag@1.0.2/node_modules/has-tostringtag/shams.js\")();\n\n/** @type {import('.')} */\nmodule.exports = function isBoolean(value) {\n\tif (typeof value === 'boolean') {\n\t\treturn true;\n\t}\n\tif (value === null || typeof value !== 'object') {\n\t\treturn false;\n\t}\n\treturn hasToStringTag ? tryBooleanObject(value) : $toString(value) === boolClass;\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vaXMtYm9vbGVhbi1vYmplY3RAMS4yLjIvbm9kZV9tb2R1bGVzL2lzLWJvb2xlYW4tb2JqZWN0L2luZGV4LmpzIiwibWFwcGluZ3MiOiJBQUFhOztBQUViLGdCQUFnQixtQkFBTyxDQUFDLGdHQUFZO0FBQ3BDO0FBQ0E7O0FBRUEsV0FBVyxhQUFhO0FBQ3hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EscUJBQXFCLG1CQUFPLENBQUMscUhBQXVCOztBQUVwRCxXQUFXLGFBQWE7QUFDeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlcyI6WyIvVXNlcnMvZ2xlbm5qZWZmZXJzb25jaGFuZHJhL0FlZ2lzUVMvc29mdHdhcmUvYWVnaXNRUy9ub2RlX21vZHVsZXMvLnBucG0vaXMtYm9vbGVhbi1vYmplY3RAMS4yLjIvbm9kZV9tb2R1bGVzL2lzLWJvb2xlYW4tb2JqZWN0L2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIGNhbGxCb3VuZCA9IHJlcXVpcmUoJ2NhbGwtYm91bmQnKTtcbnZhciAkYm9vbFRvU3RyID0gY2FsbEJvdW5kKCdCb29sZWFuLnByb3RvdHlwZS50b1N0cmluZycpO1xudmFyICR0b1N0cmluZyA9IGNhbGxCb3VuZCgnT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZycpO1xuXG4vKiogQHR5cGUge2ltcG9ydCgnLicpfSAqL1xudmFyIHRyeUJvb2xlYW5PYmplY3QgPSBmdW5jdGlvbiBib29sZWFuQnJhbmRDaGVjayh2YWx1ZSkge1xuXHR0cnkge1xuXHRcdCRib29sVG9TdHIodmFsdWUpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59O1xudmFyIGJvb2xDbGFzcyA9ICdbb2JqZWN0IEJvb2xlYW5dJztcbnZhciBoYXNUb1N0cmluZ1RhZyA9IHJlcXVpcmUoJ2hhcy10b3N0cmluZ3RhZy9zaGFtcycpKCk7XG5cbi8qKiBAdHlwZSB7aW1wb3J0KCcuJyl9ICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzQm9vbGVhbih2YWx1ZSkge1xuXHRpZiAodHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicpIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRpZiAodmFsdWUgPT09IG51bGwgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0Jykge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRyZXR1cm4gaGFzVG9TdHJpbmdUYWcgPyB0cnlCb29sZWFuT2JqZWN0KHZhbHVlKSA6ICR0b1N0cmluZyh2YWx1ZSkgPT09IGJvb2xDbGFzcztcbn07XG4iXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/is-boolean-object@1.2.2/node_modules/is-boolean-object/index.js\n");

/***/ })

};
;