"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/until-async@3.0.2";
exports.ids = ["vendor-chunks/until-async@3.0.2"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/until-async@3.0.2/node_modules/until-async/lib/index.js":
/*!************************************************************************************!*\
  !*** ./node_modules/.pnpm/until-async@3.0.2/node_modules/until-async/lib/index.js ***!
  \************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   until: () => (/* binding */ until)\n/* harmony export */ });\n//#region src/index.ts\n/**\n* Gracefully handles a callback that returns a promise.\n*\n* @example\n* await until(() => Promise.resolve(123))\n* // [null, 123]\n*\n* await until(() => Promise.reject(new Error('Oops!')))\n* // [new Error('Oops!'), null]\n*/\nasync function until(callback) {\n\ttry {\n\t\treturn [null, await callback().catch((error) => {\n\t\t\tthrow error;\n\t\t})];\n\t} catch (error) {\n\t\treturn [error, null];\n\t}\n}\n\n//#endregion\n\n//# sourceMappingURL=index.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vdW50aWwtYXN5bmNAMy4wLjIvbm9kZV9tb2R1bGVzL3VudGlsLWFzeW5jL2xpYi9pbmRleC5qcyIsIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEdBQUc7QUFDSDtBQUNBO0FBQ0E7O0FBRUE7QUFDaUI7QUFDakIiLCJzb3VyY2VzIjpbIi9Vc2Vycy9nbGVubmplZmZlcnNvbmNoYW5kcmEvQWVnaXNRUy9zb2Z0d2FyZS9hZWdpc1FTL25vZGVfbW9kdWxlcy8ucG5wbS91bnRpbC1hc3luY0AzLjAuMi9ub2RlX21vZHVsZXMvdW50aWwtYXN5bmMvbGliL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vI3JlZ2lvbiBzcmMvaW5kZXgudHNcbi8qKlxuKiBHcmFjZWZ1bGx5IGhhbmRsZXMgYSBjYWxsYmFjayB0aGF0IHJldHVybnMgYSBwcm9taXNlLlxuKlxuKiBAZXhhbXBsZVxuKiBhd2FpdCB1bnRpbCgoKSA9PiBQcm9taXNlLnJlc29sdmUoMTIzKSlcbiogLy8gW251bGwsIDEyM11cbipcbiogYXdhaXQgdW50aWwoKCkgPT4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdPb3BzIScpKSlcbiogLy8gW25ldyBFcnJvcignT29wcyEnKSwgbnVsbF1cbiovXG5hc3luYyBmdW5jdGlvbiB1bnRpbChjYWxsYmFjaykge1xuXHR0cnkge1xuXHRcdHJldHVybiBbbnVsbCwgYXdhaXQgY2FsbGJhY2soKS5jYXRjaCgoZXJyb3IpID0+IHtcblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH0pXTtcblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRyZXR1cm4gW2Vycm9yLCBudWxsXTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IHVudGlsIH07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5qcy5tYXAiXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/until-async@3.0.2/node_modules/until-async/lib/index.js\n");

/***/ })

};
;