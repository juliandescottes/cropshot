(function () {
	var dropArea = document.getElementById("drop-area");
	var previewContainer = document.getElementById("cropshot-preview-container");
	var mouseHelper = document.getElementById("mouse-tooltip");
	var _canvas = null, _isCropping = false, _selectionRectangle = null, _cropData = null;

	var __templates = {};
	var __getTemplate = function (id) {
		if (__templates[id]) {
			return __templates[id];	
		} else {
			var el = document.getElementById(id+"-template");
			if (el) {
				return __templates[id] = el.innerHTML
			} else {
				throw new Error("Couldn't retrieve template for " + id);
			}
		}
	};

	var cropCanvas = function (sourceCanvas, cropData) {
		var fixedData = fixRectData(cropData);
		var x1 = fixedData.x1, x2 = fixedData.x2+4, 
			y1 = fixedData.y1, y2 = fixedData.y2+4,
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
		selectionRectangle.className = "selection-rectangle";
		selectionRectangle.onmousemove = onMouseMove;
		selectionRectangle.onmouseup = stopCropping;
		document.body.appendChild(selectionRectangle);
		return selectionRectangle;
	};

	var initializeCropData = function (event) {
		var x = event.clientX, 
			y = event.clientY, 
			xy = __boundCoordsInCanvas(x, y);
		_cropData = {};
		_cropData.x1 = _cropData.x2 = xy.x, _cropData.y1 = _cropData.y2 = xy.y;
	}

	var updateCropData = function (event) {
		var x = event.clientX, 
			y = event.clientY, 
			xy = __boundCoordsInCanvas(x, y);
		_cropData.x2 = xy.x, _cropData.y2 = xy.y;
	};
	
	var START_OFFSET = 21, END_OFFSET = 21;
	var __boundCoordsInCanvas = function (x, y) {
		var coords = {
			'x' : Math.min(Math.max(START_OFFSET, x), END_OFFSET + Math.min(dropArea.offsetWidth, _canvas.width)),
			'y' : Math.min(Math.max(START_OFFSET, y), END_OFFSET + Math.min(dropArea.offsetHeight, _canvas.height))
		};
		return coords;
	};

	var updateSelectionFromCropData = function (selection, cropData) {
		var fixedData = fixRectData(cropData);
		_selectionRectangle.style.borderTopWidth = fixedData.y1 + "px";
		_selectionRectangle.style.borderLeftWidth = fixedData.x1 + "px";
		_selectionRectangle.style.borderBottomWidth = (document.documentElement.clientHeight - fixedData.y2) + "px";
		_selectionRectangle.style.borderRightWidth = (document.documentElement.clientWidth - fixedData.x2) + "px";
	};

	var fixRectData = function (rect) {
		var fixedData = {
			x1 : Math.min(rect.x1, rect.x2),
			x2 : Math.max(rect.x1, rect.x2),
			y1 : Math.min(rect.y1, rect.y2),
			y2 : Math.max(rect.y1, rect.y2),
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
				dropArea.innerHTML = "";
				dropArea.appendChild(_canvas);
				document.body.classList.add("croppable");
				mouseHelper.classList.add("tooltip-visible");
			})
		} else {
			console.log("Your clipboard doesn't contain an image :(");
		}				
	};

	var onMouseMove = function (event) {
		mouseHelper.style.top = (event.y + 10) + "px"
		mouseHelper.style.left = (event.x + 10) + "px"
		if(_isCropping) {
			updateCropData(event);
			updateSelectionFromCropData (_selectionRectangle, _cropData);
			var fixedData = fixRectData(_cropData);

			mouseHelper.innerHTML = (fixedData.x2 - fixedData.x1) + "x" + (fixedData.y2 - fixedData.y1)
		} else if (_canvas !== null)	 {
			var x = event.clientX, 
			y = event.clientY, 
			xy = __boundCoordsInCanvas(x, y);
			mouseHelper.innerHTML = (xy.x-START_OFFSET) + ":" + (xy.y-START_OFFSET);
		}
	};

	var dismissPreview = function () {
		previewContainer.classList.remove("show");
		previewContainer.innerHTML = "";
		document.body.classList.add("croppable");
		mouseHelper.classList.add("tooltip-visible");
	};

	var onSaveCompleted = function (result) {
		if (!result.error) {
			var src = SERVICE_URL + "img/" + result.responseText;
			previewContainer.innerHTML = __getTemplate("cropshot-preview").replace(/{{src}}/g, src);
			previewContainer.classList.add("show");
			document.body.classList.remove("croppable");
			mouseHelper.classList.remove("tooltip-visible");
		} else {
			console.log("Couldn't save image : " + result.error);
		}
		
		_selectionRectangle.parentNode.removeChild(_selectionRectangle);
	};

	var SERVICE_URL = "http://screenletstore.appspot.com/";
	var cropImageAndUpload = function (canvas, cropData, callback) {
		try {
			// crop canvas
			canvas = cropCanvas(canvas, cropData);
			var xhr = new XMLHttpRequest(),
				formData = new FormData();
			formData.append('data', canvas.toDataURL("image/png"));
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
		var fixedData = fixRectData(cropData);
		var xOffset = container.scrollLeft - (container.offsetLeft + 1);
		var yOffset = container.scrollTop - (container.offsetTop + 1);
		var absoluteData = {
			x1 : fixedData.x1 + xOffset, x2 : fixedData.x2 - 4 + xOffset,
			y1 : fixedData.y1 + yOffset, y2 : fixedData.y2 - 4 + yOffset 
		};
		return absoluteData;
	};

	var startCropping = function (event) {
		if (!isAncestor(previewContainer, event.target)) {
			if (_canvas !== null) {
				_isCropping = true;
				_selectionRectangle = createSelectionRectangle();
				initializeCropData(event);
				updateSelectionFromCropData(_selectionRectangle, _cropData);
				event.preventDefault();	
			}
		}
	};

	var isAncestor = function (element, child) {
		var ancestor = child;
		while (ancestor && (ancestor != element) && (ancestor = ancestor.parentNode)) {}
		return ancestor == element;
	}

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
	window.addEventListener("mousedown", startCropping);

	window.dismissPreview = dismissPreview;
})();