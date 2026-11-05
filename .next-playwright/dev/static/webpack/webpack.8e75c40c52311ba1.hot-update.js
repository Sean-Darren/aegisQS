"use strict";
self["webpackHotUpdate_N_E"]("webpack",{},
/******/ function(__webpack_require__) { // webpackRuntimeModules
/******/ /* webpack/runtime/get mini-css chunk filename */
/******/ (() => {
/******/ 	// This function allow to reference async chunks
/******/ 	__webpack_require__.miniCssF = (chunkId) => {
/******/ 		// return url for filenames based on template
/******/ 		return "static/css/" + chunkId + ".css";
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/getFullHash */
/******/ (() => {
/******/ 	__webpack_require__.h = () => ("a51702b8545d36e6")
/******/ })();
/******/ 
/******/ /* webpack/runtime/relative url */
/******/ (() => {
/******/ 	__webpack_require__.U = function RelativeURL(url) {
/******/ 		var realUrl = new URL(url, "x:/");
/******/ 		var values = {};
/******/ 		for (var key in realUrl) values[key] = realUrl[key];
/******/ 		values.href = url;
/******/ 		values.pathname = url.replace(/[?#].*/, "");
/******/ 		values.origin = values.protocol = "";
/******/ 		values.toString = values.toJSON = () => (url);
/******/ 		for (var key in values) Object.defineProperty(this, key, { enumerable: true, configurable: true, value: values[key] });
/******/ 	};
/******/ 	__webpack_require__.U.prototype = URL.prototype;
/******/ })();
/******/ 
/******/ /* webpack/runtime/css loading */
/******/ (() => {
/******/ 	var createStylesheet = (chunkId, fullhref, resolve, reject) => {
/******/ 		var linkTag = document.createElement("link");
/******/ 	
/******/ 		linkTag.rel = "stylesheet";
/******/ 		linkTag.type = "text/css";
/******/ 		var onLinkComplete = (event) => {
/******/ 			// avoid mem leaks.
/******/ 			linkTag.onerror = linkTag.onload = null;
/******/ 			if (event.type === 'load') {
/******/ 				resolve();
/******/ 			} else {
/******/ 				var errorType = event && (event.type === 'load' ? 'missing' : event.type);
/******/ 				var realHref = event && event.target && event.target.href || fullhref;
/******/ 				var err = new Error("Loading CSS chunk " + chunkId + " failed.\n(" + realHref + ")");
/******/ 				err.code = "CSS_CHUNK_LOAD_FAILED";
/******/ 				err.type = errorType;
/******/ 				err.request = realHref;
/******/ 				linkTag.parentNode.removeChild(linkTag)
/******/ 				reject(err);
/******/ 			}
/******/ 		}
/******/ 		linkTag.onerror = linkTag.onload = onLinkComplete;
/******/ 		linkTag.href = fullhref;
/******/ 	
/******/ 		(function(linkTag) {
/******/ 		                if (typeof _N_E_STYLE_LOAD === 'function') {
/******/ 		                    // Avoid destructuring and optional-chaining here: this function
/******/ 		                    // is serialized as a string by mini-css-extract-plugin and
/******/ 		                    // injected directly into the browser bundle without further
/******/ 		                    // transpilation. Destructuring (`const { x } = obj`) breaks on
/******/ 		                    // browsers that pre-date ES2015 support (e.g. Chrome <49).
/******/ 		                    var href = linkTag.href;
/******/ 		                    var onload = linkTag.onload;
/******/ 		                    var onerror = linkTag.onerror;
/******/ 		                    _N_E_STYLE_LOAD(href.indexOf(window.location.origin) === 0 ? new URL(href).pathname : href).then(function() {
/******/ 		                        if (onload) onload.call(linkTag, {
/******/ 		                            type: 'load'
/******/ 		                        });
/******/ 		                    }, function() {
/******/ 		                        if (onerror) onerror.call(linkTag, {});
/******/ 		                    });
/******/ 		                } else {
/******/ 		                    document.head.appendChild(linkTag);
/******/ 		                }
/******/ 		            })(linkTag)
/******/ 		return linkTag;
/******/ 	};
/******/ 	var findStylesheet = (href, fullhref) => {
/******/ 		var existingLinkTags = document.getElementsByTagName("link");
/******/ 		for(var i = 0; i < existingLinkTags.length; i++) {
/******/ 			var tag = existingLinkTags[i];
/******/ 			var dataHref = tag.getAttribute("data-href") || tag.getAttribute("href");
/******/ 			if(tag.rel === "stylesheet" && (dataHref === href || dataHref === fullhref)) return tag;
/******/ 		}
/******/ 		var existingStyleTags = document.getElementsByTagName("style");
/******/ 		for(var i = 0; i < existingStyleTags.length; i++) {
/******/ 			var tag = existingStyleTags[i];
/******/ 			var dataHref = tag.getAttribute("data-href");
/******/ 			if(dataHref === href || dataHref === fullhref) return tag;
/******/ 		}
/******/ 	};
/******/ 	var loadStylesheet = (chunkId) => {
/******/ 		return new Promise((resolve, reject) => {
/******/ 			var href = __webpack_require__.miniCssF(chunkId);
/******/ 			var fullhref = __webpack_require__.p + href;
/******/ 			if(findStylesheet(href, fullhref)) return resolve();
/******/ 			createStylesheet(chunkId, fullhref, resolve, reject);
/******/ 		});
/******/ 	}
/******/ 	// object to store loaded CSS chunks
/******/ 	var installedCssChunks = {
/******/ 		"webpack": 0
/******/ 	};
/******/ 	
/******/ 	__webpack_require__.f.miniCss = (chunkId, promises) => {
/******/ 		var cssChunks = {"_app-pages-browser_src_components_viewer_pdf-canvas_tsx":1};
/******/ 		if(installedCssChunks[chunkId]) promises.push(installedCssChunks[chunkId]);
/******/ 		else if(installedCssChunks[chunkId] !== 0 && cssChunks[chunkId]) {
/******/ 			promises.push(installedCssChunks[chunkId] = loadStylesheet(chunkId).then(() => {
/******/ 				installedCssChunks[chunkId] = 0;
/******/ 			}, (e) => {
/******/ 				delete installedCssChunks[chunkId];
/******/ 				throw e;
/******/ 			}));
/******/ 		}
/******/ 	};
/******/ 	
/******/ 	var oldTags = [];
/******/ 	var newTags = [];
/******/ 	var applyHandler = (options) => {
/******/ 		return { dispose: () => {
/******/ 			for(var i = 0; i < oldTags.length; i++) {
/******/ 				var oldTag = oldTags[i];
/******/ 				if(oldTag.parentNode) oldTag.parentNode.removeChild(oldTag);
/******/ 			}
/******/ 			oldTags.length = 0;
/******/ 		}, apply: () => {
/******/ 			for(var i = 0; i < newTags.length; i++) newTags[i].rel = "stylesheet";
/******/ 			newTags.length = 0;
/******/ 		} };
/******/ 	}
/******/ 	__webpack_require__.hmrC.miniCss = (chunkIds, removedChunks, removedModules, promises, applyHandlers, updatedModulesList) => {
/******/ 		applyHandlers.push(applyHandler);
/******/ 		chunkIds.forEach((chunkId) => {
/******/ 			var href = __webpack_require__.miniCssF(chunkId);
/******/ 			var fullhref = __webpack_require__.p + href;
/******/ 			var oldTag = findStylesheet(href, fullhref);
/******/ 			if(!oldTag) return;
/******/ 			promises.push(new Promise((resolve, reject) => {
/******/ 				var tag = createStylesheet(chunkId, fullhref, () => {
/******/ 					tag.as = "style";
/******/ 					tag.rel = "preload";
/******/ 					resolve();
/******/ 				}, reject);
/******/ 				oldTags.push(oldTag);
/******/ 				newTags.push(tag);
/******/ 			}));
/******/ 		});
/******/ 	}
/******/ })();
/******/ 
/******/ /* webpack/runtime/nonce */
/******/ (() => {
/******/ 	__webpack_require__.nc = undefined;
/******/ })();
/******/ 
/******/ }
)
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJpZ25vcmVMaXN0IjpbMF0sIm1hcHBpbmdzIjoiQUFBQSIsInNvdXJjZXMiOlsid2VicGFjay1pbnRlcm5hbDovL25leHRqcy93ZWJwYWNrLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIFRoaXMgc291cmNlIHdhcyBnZW5lcmF0ZWQgYnkgTmV4dC5qcyBiYXNlZCBvZmYgb2YgdGhlIGdlbmVyYXRlZCBXZWJwYWNrIHJ1bnRpbWUuXG4vLyBUaGUgbWFwcGluZ3MgYXJlIGluY29ycmVjdC5cbi8vIFRvIGdldCB0aGUgY29ycmVjdCBsaW5lL2NvbHVtbiBtYXBwaW5ncywgdHVybiBvZmYgc291cmNlbWFwcyBpbiB5b3VyIGRlYnVnZ2VyLlxuXG5zZWxmW1wid2VicGFja0hvdFVwZGF0ZV9OX0VcIl0oXCJ3ZWJwYWNrXCIse30sXG4vKioqKioqLyBmdW5jdGlvbihfX3dlYnBhY2tfcmVxdWlyZV9fKSB7IC8vIHdlYnBhY2tSdW50aW1lTW9kdWxlc1xuLyoqKioqKi8gLyogd2VicGFjay9ydW50aW1lL2dldCBtaW5pLWNzcyBjaHVuayBmaWxlbmFtZSAqL1xuLyoqKioqKi8gKCgpID0+IHtcbi8qKioqKiovIFx0Ly8gVGhpcyBmdW5jdGlvbiBhbGxvdyB0byByZWZlcmVuY2UgYXN5bmMgY2h1bmtzXG4vKioqKioqLyBcdF9fd2VicGFja19yZXF1aXJlX18ubWluaUNzc0YgPSAoY2h1bmtJZCkgPT4ge1xuLyoqKioqKi8gXHRcdC8vIHJldHVybiB1cmwgZm9yIGZpbGVuYW1lcyBiYXNlZCBvbiB0ZW1wbGF0ZVxuLyoqKioqKi8gXHRcdHJldHVybiBcInN0YXRpYy9jc3MvXCIgKyBjaHVua0lkICsgXCIuY3NzXCI7XG4vKioqKioqLyBcdH07XG4vKioqKioqLyB9KSgpO1xuLyoqKioqKi8gXG4vKioqKioqLyAvKiB3ZWJwYWNrL3J1bnRpbWUvZ2V0RnVsbEhhc2ggKi9cbi8qKioqKiovICgoKSA9PiB7XG4vKioqKioqLyBcdF9fd2VicGFja19yZXF1aXJlX18uaCA9ICgpID0+IChcImE1MTcwMmI4NTQ1ZDM2ZTZcIilcbi8qKioqKiovIH0pKCk7XG4vKioqKioqLyBcbi8qKioqKiovIC8qIHdlYnBhY2svcnVudGltZS9yZWxhdGl2ZSB1cmwgKi9cbi8qKioqKiovICgoKSA9PiB7XG4vKioqKioqLyBcdF9fd2VicGFja19yZXF1aXJlX18uVSA9IGZ1bmN0aW9uIFJlbGF0aXZlVVJMKHVybCkge1xuLyoqKioqKi8gXHRcdHZhciByZWFsVXJsID0gbmV3IFVSTCh1cmwsIFwieDovXCIpO1xuLyoqKioqKi8gXHRcdHZhciB2YWx1ZXMgPSB7fTtcbi8qKioqKiovIFx0XHRmb3IgKHZhciBrZXkgaW4gcmVhbFVybCkgdmFsdWVzW2tleV0gPSByZWFsVXJsW2tleV07XG4vKioqKioqLyBcdFx0dmFsdWVzLmhyZWYgPSB1cmw7XG4vKioqKioqLyBcdFx0dmFsdWVzLnBhdGhuYW1lID0gdXJsLnJlcGxhY2UoL1s/I10uKi8sIFwiXCIpO1xuLyoqKioqKi8gXHRcdHZhbHVlcy5vcmlnaW4gPSB2YWx1ZXMucHJvdG9jb2wgPSBcIlwiO1xuLyoqKioqKi8gXHRcdHZhbHVlcy50b1N0cmluZyA9IHZhbHVlcy50b0pTT04gPSAoKSA9PiAodXJsKTtcbi8qKioqKiovIFx0XHRmb3IgKHZhciBrZXkgaW4gdmFsdWVzKSBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGNvbmZpZ3VyYWJsZTogdHJ1ZSwgdmFsdWU6IHZhbHVlc1trZXldIH0pO1xuLyoqKioqKi8gXHR9O1xuLyoqKioqKi8gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLlUucHJvdG90eXBlID0gVVJMLnByb3RvdHlwZTtcbi8qKioqKiovIH0pKCk7XG4vKioqKioqLyBcbi8qKioqKiovIC8qIHdlYnBhY2svcnVudGltZS9jc3MgbG9hZGluZyAqL1xuLyoqKioqKi8gKCgpID0+IHtcbi8qKioqKiovIFx0dmFyIGNyZWF0ZVN0eWxlc2hlZXQgPSAoY2h1bmtJZCwgZnVsbGhyZWYsIHJlc29sdmUsIHJlamVjdCkgPT4ge1xuLyoqKioqKi8gXHRcdHZhciBsaW5rVGFnID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpbmtcIik7XG4vKioqKioqLyBcdFxuLyoqKioqKi8gXHRcdGxpbmtUYWcucmVsID0gXCJzdHlsZXNoZWV0XCI7XG4vKioqKioqLyBcdFx0bGlua1RhZy50eXBlID0gXCJ0ZXh0L2Nzc1wiO1xuLyoqKioqKi8gXHRcdHZhciBvbkxpbmtDb21wbGV0ZSA9IChldmVudCkgPT4ge1xuLyoqKioqKi8gXHRcdFx0Ly8gYXZvaWQgbWVtIGxlYWtzLlxuLyoqKioqKi8gXHRcdFx0bGlua1RhZy5vbmVycm9yID0gbGlua1RhZy5vbmxvYWQgPSBudWxsO1xuLyoqKioqKi8gXHRcdFx0aWYgKGV2ZW50LnR5cGUgPT09ICdsb2FkJykge1xuLyoqKioqKi8gXHRcdFx0XHRyZXNvbHZlKCk7XG4vKioqKioqLyBcdFx0XHR9IGVsc2Uge1xuLyoqKioqKi8gXHRcdFx0XHR2YXIgZXJyb3JUeXBlID0gZXZlbnQgJiYgKGV2ZW50LnR5cGUgPT09ICdsb2FkJyA/ICdtaXNzaW5nJyA6IGV2ZW50LnR5cGUpO1xuLyoqKioqKi8gXHRcdFx0XHR2YXIgcmVhbEhyZWYgPSBldmVudCAmJiBldmVudC50YXJnZXQgJiYgZXZlbnQudGFyZ2V0LmhyZWYgfHwgZnVsbGhyZWY7XG4vKioqKioqLyBcdFx0XHRcdHZhciBlcnIgPSBuZXcgRXJyb3IoXCJMb2FkaW5nIENTUyBjaHVuayBcIiArIGNodW5rSWQgKyBcIiBmYWlsZWQuXFxuKFwiICsgcmVhbEhyZWYgKyBcIilcIik7XG4vKioqKioqLyBcdFx0XHRcdGVyci5jb2RlID0gXCJDU1NfQ0hVTktfTE9BRF9GQUlMRURcIjtcbi8qKioqKiovIFx0XHRcdFx0ZXJyLnR5cGUgPSBlcnJvclR5cGU7XG4vKioqKioqLyBcdFx0XHRcdGVyci5yZXF1ZXN0ID0gcmVhbEhyZWY7XG4vKioqKioqLyBcdFx0XHRcdGxpbmtUYWcucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChsaW5rVGFnKVxuLyoqKioqKi8gXHRcdFx0XHRyZWplY3QoZXJyKTtcbi8qKioqKiovIFx0XHRcdH1cbi8qKioqKiovIFx0XHR9XG4vKioqKioqLyBcdFx0bGlua1RhZy5vbmVycm9yID0gbGlua1RhZy5vbmxvYWQgPSBvbkxpbmtDb21wbGV0ZTtcbi8qKioqKiovIFx0XHRsaW5rVGFnLmhyZWYgPSBmdWxsaHJlZjtcbi8qKioqKiovIFx0XG4vKioqKioqLyBcdFx0KGZ1bmN0aW9uKGxpbmtUYWcpIHtcbi8qKioqKiovIFx0XHQgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBfTl9FX1NUWUxFX0xPQUQgPT09ICdmdW5jdGlvbicpIHtcbi8qKioqKiovIFx0XHQgICAgICAgICAgICAgICAgICAgIC8vIEF2b2lkIGRlc3RydWN0dXJpbmcgYW5kIG9wdGlvbmFsLWNoYWluaW5nIGhlcmU6IHRoaXMgZnVuY3Rpb25cbi8qKioqKiovIFx0XHQgICAgICAgICAgICAgICAgICAgIC8vIGlzIHNlcmlhbGl6ZWQgYXMgYSBzdHJpbmcgYnkgbWluaS1jc3MtZXh0cmFjdC1wbHVnaW4gYW5kXG4vKioqKioqLyBcdFx0ICAgICAgICAgICAgICAgICAgICAvLyBpbmplY3RlZCBkaXJlY3RseSBpbnRvIHRoZSBicm93c2VyIGJ1bmRsZSB3aXRob3V0IGZ1cnRoZXJcbi8qKioqKiovIFx0XHQgICAgICAgICAgICAgICAgICAgIC8vIHRyYW5zcGlsYXRpb24uIERlc3RydWN0dXJpbmcgKGBjb25zdCB7IHggfSA9IG9iamApIGJyZWFrcyBvblxuLyoqKioqKi8gXHRcdCAgICAgICAgICAgICAgICAgICAgLy8gYnJvd3NlcnMgdGhhdCBwcmUtZGF0ZSBFUzIwMTUgc3VwcG9ydCAoZS5nLiBDaHJvbWUgPDQ5KS5cbi8qKioqKiovIFx0XHQgICAgICAgICAgICAgICAgICAgIHZhciBocmVmID0gbGlua1RhZy5ocmVmO1xuLyoqKioqKi8gXHRcdCAgICAgICAgICAgICAgICAgICAgdmFyIG9ubG9hZCA9IGxpbmtUYWcub25sb2FkO1xuLyoqKioqKi8gXHRcdCAgICAgICAgICAgICAgICAgICAgdmFyIG9uZXJyb3IgPSBsaW5rVGFnLm9uZXJyb3I7XG4vKioqKioqLyBcdFx0ICAgICAgICAgICAgICAgICAgICBfTl9FX1NUWUxFX0xPQUQoaHJlZi5pbmRleE9mKHdpbmRvdy5sb2NhdGlvbi5vcmlnaW4pID09PSAwID8gbmV3IFVSTChocmVmKS5wYXRobmFtZSA6IGhyZWYpLnRoZW4oZnVuY3Rpb24oKSB7XG4vKioqKioqLyBcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9ubG9hZCkgb25sb2FkLmNhbGwobGlua1RhZywge1xuLyoqKioqKi8gXHRcdCAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnbG9hZCdcbi8qKioqKiovIFx0XHQgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbi8qKioqKiovIFx0XHQgICAgICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uKCkge1xuLyoqKioqKi8gXHRcdCAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvbmVycm9yKSBvbmVycm9yLmNhbGwobGlua1RhZywge30pO1xuLyoqKioqKi8gXHRcdCAgICAgICAgICAgICAgICAgICAgfSk7XG4vKioqKioqLyBcdFx0ICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4vKioqKioqLyBcdFx0ICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKGxpbmtUYWcpO1xuLyoqKioqKi8gXHRcdCAgICAgICAgICAgICAgICB9XG4vKioqKioqLyBcdFx0ICAgICAgICAgICAgfSkobGlua1RhZylcbi8qKioqKiovIFx0XHRyZXR1cm4gbGlua1RhZztcbi8qKioqKiovIFx0fTtcbi8qKioqKiovIFx0dmFyIGZpbmRTdHlsZXNoZWV0ID0gKGhyZWYsIGZ1bGxocmVmKSA9PiB7XG4vKioqKioqLyBcdFx0dmFyIGV4aXN0aW5nTGlua1RhZ3MgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcImxpbmtcIik7XG4vKioqKioqLyBcdFx0Zm9yKHZhciBpID0gMDsgaSA8IGV4aXN0aW5nTGlua1RhZ3MubGVuZ3RoOyBpKyspIHtcbi8qKioqKiovIFx0XHRcdHZhciB0YWcgPSBleGlzdGluZ0xpbmtUYWdzW2ldO1xuLyoqKioqKi8gXHRcdFx0dmFyIGRhdGFIcmVmID0gdGFnLmdldEF0dHJpYnV0ZShcImRhdGEtaHJlZlwiKSB8fCB0YWcuZ2V0QXR0cmlidXRlKFwiaHJlZlwiKTtcbi8qKioqKiovIFx0XHRcdGlmKHRhZy5yZWwgPT09IFwic3R5bGVzaGVldFwiICYmIChkYXRhSHJlZiA9PT0gaHJlZiB8fCBkYXRhSHJlZiA9PT0gZnVsbGhyZWYpKSByZXR1cm4gdGFnO1xuLyoqKioqKi8gXHRcdH1cbi8qKioqKiovIFx0XHR2YXIgZXhpc3RpbmdTdHlsZVRhZ3MgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcInN0eWxlXCIpO1xuLyoqKioqKi8gXHRcdGZvcih2YXIgaSA9IDA7IGkgPCBleGlzdGluZ1N0eWxlVGFncy5sZW5ndGg7IGkrKykge1xuLyoqKioqKi8gXHRcdFx0dmFyIHRhZyA9IGV4aXN0aW5nU3R5bGVUYWdzW2ldO1xuLyoqKioqKi8gXHRcdFx0dmFyIGRhdGFIcmVmID0gdGFnLmdldEF0dHJpYnV0ZShcImRhdGEtaHJlZlwiKTtcbi8qKioqKiovIFx0XHRcdGlmKGRhdGFIcmVmID09PSBocmVmIHx8IGRhdGFIcmVmID09PSBmdWxsaHJlZikgcmV0dXJuIHRhZztcbi8qKioqKiovIFx0XHR9XG4vKioqKioqLyBcdH07XG4vKioqKioqLyBcdHZhciBsb2FkU3R5bGVzaGVldCA9IChjaHVua0lkKSA9PiB7XG4vKioqKioqLyBcdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbi8qKioqKiovIFx0XHRcdHZhciBocmVmID0gX193ZWJwYWNrX3JlcXVpcmVfXy5taW5pQ3NzRihjaHVua0lkKTtcbi8qKioqKiovIFx0XHRcdHZhciBmdWxsaHJlZiA9IF9fd2VicGFja19yZXF1aXJlX18ucCArIGhyZWY7XG4vKioqKioqLyBcdFx0XHRpZihmaW5kU3R5bGVzaGVldChocmVmLCBmdWxsaHJlZikpIHJldHVybiByZXNvbHZlKCk7XG4vKioqKioqLyBcdFx0XHRjcmVhdGVTdHlsZXNoZWV0KGNodW5rSWQsIGZ1bGxocmVmLCByZXNvbHZlLCByZWplY3QpO1xuLyoqKioqKi8gXHRcdH0pO1xuLyoqKioqKi8gXHR9XG4vKioqKioqLyBcdC8vIG9iamVjdCB0byBzdG9yZSBsb2FkZWQgQ1NTIGNodW5rc1xuLyoqKioqKi8gXHR2YXIgaW5zdGFsbGVkQ3NzQ2h1bmtzID0ge1xuLyoqKioqKi8gXHRcdFwid2VicGFja1wiOiAwXG4vKioqKioqLyBcdH07XG4vKioqKioqLyBcdFxuLyoqKioqKi8gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmYubWluaUNzcyA9IChjaHVua0lkLCBwcm9taXNlcykgPT4ge1xuLyoqKioqKi8gXHRcdHZhciBjc3NDaHVua3MgPSB7XCJfYXBwLXBhZ2VzLWJyb3dzZXJfc3JjX2NvbXBvbmVudHNfdmlld2VyX3BkZi1jYW52YXNfdHN4XCI6MX07XG4vKioqKioqLyBcdFx0aWYoaW5zdGFsbGVkQ3NzQ2h1bmtzW2NodW5rSWRdKSBwcm9taXNlcy5wdXNoKGluc3RhbGxlZENzc0NodW5rc1tjaHVua0lkXSk7XG4vKioqKioqLyBcdFx0ZWxzZSBpZihpbnN0YWxsZWRDc3NDaHVua3NbY2h1bmtJZF0gIT09IDAgJiYgY3NzQ2h1bmtzW2NodW5rSWRdKSB7XG4vKioqKioqLyBcdFx0XHRwcm9taXNlcy5wdXNoKGluc3RhbGxlZENzc0NodW5rc1tjaHVua0lkXSA9IGxvYWRTdHlsZXNoZWV0KGNodW5rSWQpLnRoZW4oKCkgPT4ge1xuLyoqKioqKi8gXHRcdFx0XHRpbnN0YWxsZWRDc3NDaHVua3NbY2h1bmtJZF0gPSAwO1xuLyoqKioqKi8gXHRcdFx0fSwgKGUpID0+IHtcbi8qKioqKiovIFx0XHRcdFx0ZGVsZXRlIGluc3RhbGxlZENzc0NodW5rc1tjaHVua0lkXTtcbi8qKioqKiovIFx0XHRcdFx0dGhyb3cgZTtcbi8qKioqKiovIFx0XHRcdH0pKTtcbi8qKioqKiovIFx0XHR9XG4vKioqKioqLyBcdH07XG4vKioqKioqLyBcdFxuLyoqKioqKi8gXHR2YXIgb2xkVGFncyA9IFtdO1xuLyoqKioqKi8gXHR2YXIgbmV3VGFncyA9IFtdO1xuLyoqKioqKi8gXHR2YXIgYXBwbHlIYW5kbGVyID0gKG9wdGlvbnMpID0+IHtcbi8qKioqKiovIFx0XHRyZXR1cm4geyBkaXNwb3NlOiAoKSA9PiB7XG4vKioqKioqLyBcdFx0XHRmb3IodmFyIGkgPSAwOyBpIDwgb2xkVGFncy5sZW5ndGg7IGkrKykge1xuLyoqKioqKi8gXHRcdFx0XHR2YXIgb2xkVGFnID0gb2xkVGFnc1tpXTtcbi8qKioqKiovIFx0XHRcdFx0aWYob2xkVGFnLnBhcmVudE5vZGUpIG9sZFRhZy5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG9sZFRhZyk7XG4vKioqKioqLyBcdFx0XHR9XG4vKioqKioqLyBcdFx0XHRvbGRUYWdzLmxlbmd0aCA9IDA7XG4vKioqKioqLyBcdFx0fSwgYXBwbHk6ICgpID0+IHtcbi8qKioqKiovIFx0XHRcdGZvcih2YXIgaSA9IDA7IGkgPCBuZXdUYWdzLmxlbmd0aDsgaSsrKSBuZXdUYWdzW2ldLnJlbCA9IFwic3R5bGVzaGVldFwiO1xuLyoqKioqKi8gXHRcdFx0bmV3VGFncy5sZW5ndGggPSAwO1xuLyoqKioqKi8gXHRcdH0gfTtcbi8qKioqKiovIFx0fVxuLyoqKioqKi8gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmhtckMubWluaUNzcyA9IChjaHVua0lkcywgcmVtb3ZlZENodW5rcywgcmVtb3ZlZE1vZHVsZXMsIHByb21pc2VzLCBhcHBseUhhbmRsZXJzLCB1cGRhdGVkTW9kdWxlc0xpc3QpID0+IHtcbi8qKioqKiovIFx0XHRhcHBseUhhbmRsZXJzLnB1c2goYXBwbHlIYW5kbGVyKTtcbi8qKioqKiovIFx0XHRjaHVua0lkcy5mb3JFYWNoKChjaHVua0lkKSA9PiB7XG4vKioqKioqLyBcdFx0XHR2YXIgaHJlZiA9IF9fd2VicGFja19yZXF1aXJlX18ubWluaUNzc0YoY2h1bmtJZCk7XG4vKioqKioqLyBcdFx0XHR2YXIgZnVsbGhyZWYgPSBfX3dlYnBhY2tfcmVxdWlyZV9fLnAgKyBocmVmO1xuLyoqKioqKi8gXHRcdFx0dmFyIG9sZFRhZyA9IGZpbmRTdHlsZXNoZWV0KGhyZWYsIGZ1bGxocmVmKTtcbi8qKioqKiovIFx0XHRcdGlmKCFvbGRUYWcpIHJldHVybjtcbi8qKioqKiovIFx0XHRcdHByb21pc2VzLnB1c2gobmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuLyoqKioqKi8gXHRcdFx0XHR2YXIgdGFnID0gY3JlYXRlU3R5bGVzaGVldChjaHVua0lkLCBmdWxsaHJlZiwgKCkgPT4ge1xuLyoqKioqKi8gXHRcdFx0XHRcdHRhZy5hcyA9IFwic3R5bGVcIjtcbi8qKioqKiovIFx0XHRcdFx0XHR0YWcucmVsID0gXCJwcmVsb2FkXCI7XG4vKioqKioqLyBcdFx0XHRcdFx0cmVzb2x2ZSgpO1xuLyoqKioqKi8gXHRcdFx0XHR9LCByZWplY3QpO1xuLyoqKioqKi8gXHRcdFx0XHRvbGRUYWdzLnB1c2gob2xkVGFnKTtcbi8qKioqKiovIFx0XHRcdFx0bmV3VGFncy5wdXNoKHRhZyk7XG4vKioqKioqLyBcdFx0XHR9KSk7XG4vKioqKioqLyBcdFx0fSk7XG4vKioqKioqLyBcdH1cbi8qKioqKiovIH0pKCk7XG4vKioqKioqLyBcbi8qKioqKiovIC8qIHdlYnBhY2svcnVudGltZS9ub25jZSAqL1xuLyoqKioqKi8gKCgpID0+IHtcbi8qKioqKiovIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5uYyA9IHVuZGVmaW5lZDtcbi8qKioqKiovIH0pKCk7XG4vKioqKioqLyBcbi8qKioqKiovIH1cbikiXX0=
;