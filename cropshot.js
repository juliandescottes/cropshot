(function () {
			var dropArea = document.getElementById("drop-area");
			var preview = document.getElementById("cropshot-preview");
			var _canvas = null, _isCropping = false, _selectionRectangle = null, _cropData = null;

			var cropCanvas = function (sourceCanvas, cropData) {
				var fixedData = fixRectData(cropData);
				var x1 = fixedData.x1, x2 = fixedData.x2, 
					y1 = fixedData.y1, y2 = fixedData.y2,
			    	width = x2 - x1, height = y2 - y1;

				var canvas = document.createElement("canvas");
			    canvas.width = width;
			    canvas.height = height;
			    var context = canvas.getContext('2d');
			    context.drawImage(sourceCanvas, x1, y1, width, height, 0, 0, width, height);
			    return canvas;
			};

			var loadBlob = function (blob, callback) {
				var reader = new FileReader();
				reader.onload = function(event){
					callback(event.target.result);
				}; 
				reader.readAsDataURL(blob);
			};

			var createCanvasFromDataUrl = function (dataUrl) {
				var image = new Image(),
					canvas = document.createElement("canvas"),
					context = canvas.getContext("2d");
				image.onload = function () {
					var w = image.width, h = image.height;
					canvas.width = w;
		    		canvas.height = h;
					context.drawImage(image, 0,0,w,h,0,0,w,h);
				}
				image.src = dataUrl;
				
				return canvas;
			};

			var hasImageToCrop = function () {
				return _canvas != null;
			};

			var createSelectionRectangle = function () {
				var selectionRectangle = document.createElement("div");
				selectionRectangle.style.cssText = [
					"position:fixed",
					"border : 2px dotted red",
					"z-index:100005"
				].join(";");
				selectionRectangle.onmousemove = onMouseMove;
				selectionRectangle.onmouseup = stopCropping;
				document.body.appendChild(selectionRectangle);
				return selectionRectangle;
			};

			var initializeCropData = function (event) {
				var x = event.clientX, y = event.clientY;
				_cropData = {};
				_cropData.x1 = _cropData.x2 = x, _cropData.y1 = _cropData.y2 = y;
			}

			var updateCropData = function (event) {
				var x = event.clientX, y = event.clientY;
				x = Math.min(Math.max(21, x), 15 + Math.min(dropArea.offsetWidth, _canvas.width));
				y = Math.min(Math.max(21, y), 15 + Math.min(dropArea.offsetHeight, _canvas.height));
				_cropData.x2 = x, _cropData.y2 = y;
			};

			var updateSelectionFromCropData = function (selection, cropData) {
				var fixedData = fixRectData(cropData);
				_selectionRectangle.style.top = fixedData.y1 + "px";
				_selectionRectangle.style.left = fixedData.x1 + "px";
				_selectionRectangle.style.height = fixedData.y2 - fixedData.y1 + "px";
				_selectionRectangle.style.width = fixedData.x2 - fixedData.x1 + "px";
			};

			var fixRectData = function (rectData) {
				var fixedData = {
					x1 : Math.min(rectData.x1, rectData.x2),
					x2 : Math.max(rectData.x1, rectData.x2),
					y1 : Math.min(rectData.y1, rectData.y2),
					y2 : Math.max(rectData.y1, rectData.y2),
				};
				return fixedData;
			};

			var getBlobFromClipboard = function (clipboardData) {
				var items = clipboardData.items;
				for (var i = 0 ; i < items.length ;i++) {
					if (/^image/i.test(items[i].type)) {
						return items[i].getAsFile();
					}
				}
				return false;
			}

			var onPasteEvent = function (event) {
				var blob = getBlobFromClipboard(event.clipboardData);
				if (blob) {
					loadBlob(blob, function (result) {
						_canvas = createCanvasFromDataUrl(result);
						_canvas.addEventListener("mousedown", startCropping);
						dropArea.innerHTML = "";
						dropArea.appendChild(_canvas);
					})
				} else {
					console.log("Your clipboard doesn't contain an image :(");
				}				
			};

			var startCropping = function (event) {
				_isCropping = true;
				_selectionRectangle = createSelectionRectangle();
				initializeCropData(event);
				updateSelectionFromCropData(_selectionRectangle, _cropData);	
			};

			var onMouseMove = function (event) {
				if(_isCropping) {
					updateCropData(event);
					updateSelectionFromCropData (_selectionRectangle, _cropData);
				}
			};

			window.dismissPreview = function () {
				preview.classList.remove("show");
			};

			var onSaveCompleted = function (result) {
				if (!result.error) {
					var src = SERVICE_URL + "img/" + result.responseText;
					preview.innerHTML = "<div>Image saved at : <a href='"+src+"'>"+ src + "</a> (<a href='#' onclick='dismissPreview()'>dismiss</a>)</div><img src='"+src+"'>";
					preview.classList.add("show");
				} else {
					console.log("Couldn't save image : " + result.error);
				}
				
				_selectionRectangle.parentNode.removeChild(_selectionRectangle);
			};

			var getImageDataFromCanvas = function (canvas) {
				return canvas.toDataURL("image/png").replace("data:image/png;base64,", "");
			};

			var SERVICE_URL = "http://screenletstore.appspot.com/";
			var cropImageAndUpload = function (canvas, cropData, callback) {
				try {
					// crop canvas
					canvas = cropCanvas(canvas, cropData);
					var xhr = new XMLHttpRequest(),
						formData = new FormData();
					formData.append('data', getImageDataFromCanvas(canvas));
					xhr.open('POST', SERVICE_URL + "__/upload", true);
					xhr.onload = function(e) {
						callback({responseText : this.responseText, error : false});
					};

					xhr.send(formData);
				} catch (e) {
					callback({responseText : null, error : e.message});
				}
			};

			var calculateAbsoluteCropData = function (cropData, container) {
				var xOffset = container.scrollLeft - (container.offsetLeft + 1);
				var yOffset = container.scrollTop - (container.offsetTop + 1);
				var absoluteData = {
					x1 : cropData.x1 + xOffset, x2 : cropData.x2 + xOffset,
					y1 : cropData.y1 + yOffset, y2 : cropData.y2 + yOffset 
				};
				return absoluteData;
			};

			var stopCropping = function (event) {
				if(_isCropping) {
					_isCropping = false;
					var absoluteData = calculateAbsoluteCropData(_cropData, _canvas.parentNode);
					cropImageAndUpload(_canvas, absoluteData, onSaveCompleted);
				}
			};

			window.addEventListener("mouseup", stopCropping);
			window.addEventListener("mousemove", onMouseMove);
			window.addEventListener("paste", onPasteEvent);
		})();