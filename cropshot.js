(function () {
  /*******UTILS************/
  var _isLeftButton = function (event) {
    return event.button == 0;
  };

  var _isAncestor = function (element, child) {
    var ancestor = child;
    while (ancestor && (ancestor != element) && (ancestor = ancestor.parentNode)) {}
    return ancestor == element;
  }

  /*******CROPSHOT********/

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
        __templates[id] = el.innerHTML;
        return __templates[id];
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

  var scaleDownRetina = function () {
    return !!document.getElementById("noretina").checked;
  };

  var createCanvasFromDataUrl = function (dataUrl) {
    var image = new Image(),
      canvas = document.createElement("canvas"),
      context = canvas.getContext("2d");
    image.onload = function () {
      var w = image.width, h = image.height;

      // Scale down by the pixel density to get rid of the retina zoom...
      ratio = scaleDownRetina() ? 1 / window.devicePixelRatio : 1;
      canvas.width = w * ratio;
      canvas.height = h * ratio;
      context.scale(ratio, ratio);
      context.drawImage(image, 0, 0, w, h, 0, 0, w, h);

    };
    image.src = dataUrl;

    return canvas;
  };

  var _createCanvas = function () {
    return document.createElement("canvas");
  };

  var createSelectionRectangle = function () {
    var canvas = _createCanvas();
    canvas.classList.add("canvas-overlay");
    canvas.width = document.documentElement.clientWidth;
    canvas.height = document.documentElement.clientHeight;
    document.body.appendChild(canvas);
    return canvas;
  };

  var updateSelectionFromCropData = function (selection, cropData) {
    var fixedData = fixRectData(cropData);
    var context = _selectionRectangle.getContext("2d");
    context.fillStyle = "#000000";
    context.fillRect(0,0,document.documentElement.clientWidth, document.documentElement.clientHeight);
    context.clearRect (
      fixedData.x1, fixedData.y1,
      fixedData.x2 - fixedData.x1, fixedData.y2 - fixedData.y1);
  };

  var hasImageToCrop = function () {
    return _canvas !== null;
  };

  var initializeCropData = function (event) {
    var x = event.clientX,
      y = event.clientY,
      xy = __boundCoordsInCanvas(x, y);
    _cropData = {};
    _cropData.x1 = _cropData.x2 = xy.x, _cropData.y1 = _cropData.y2 = xy.y;
  };

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

      mouseHelper.innerHTML = (2 + fixedData.x2 - fixedData.x1) + "x" + (2 + fixedData.y2 - fixedData.y1)
    }
  };

  var copyToClipboard = function(secure_src) {
    try {
      var input = document.createElement("input");
      input.value = src;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    } catch(err) {
      return;
    }
    dismissPreview();
  }

  var dismissPreview = function () {
    previewContainer.classList.remove("show");
    previewContainer.innerHTML = "";
    document.body.classList.add("croppable");
  };

  var onSaveCompleted = function (result) {
    if (!result.error) {
      var src = SERVICE_URL + "img/" + result.responseText;
      var secure_src = SECURE_SERVICE_URL + "img/" + result.responseText;
      previewContainer.innerHTML = __getTemplate("cropshot-preview").replace(/{{src}}/g, src).replace(/{{secure_src}}/g, secure_src);
      previewContainer.classList.add("show");
      document.body.classList.remove("croppable");
    } else {
      console.log("Couldn't save image : " + result.error);
    }

    _selectionRectangle.parentNode.removeChild(_selectionRectangle);
  };

  var getCanvasImageData = function (canvas) {
    var pngImageData = canvas.toDataURL("image/png");
    // 400 000 chars in base64 ~= 300kb (reasonable file size)
    if (pngImageData.length < 400000) {
      return pngImageData;
    } else {
      // 1 300 000 chars in base64 ~= 1MB (appengine size limit)
      return getJpgImageData(canvas, 1300000);
    }
  };

  var getJpgImageData = function (canvas, maxSize) {
    var quality = 0.9;
    var jpgImageData = canvas.toDataURL("image/jpeg", quality);
    // Decrease quality to match maxSize requirement
    while (jpgImageData.length > maxSize && quality > 0.1) {
      quality -= 0.05;
      jpgImageData = canvas.toDataURL("image/jpeg", quality);
    }
    if (jpgImageData.length > maxSize) {
      alert('Image too big')
    } else {
      return jpgImageData.replace("image/jpeg", "image/jpg");
    }
  };

  var SERVICE_URL = "https://screenletstore.appspot.com/";
  var SECURE_SERVICE_URL = "https://screenletstore.appspot.com/";
  var cropImageAndUpload = function (canvas, cropData, callback) {
    try {
      // crop canvas
      canvas = cropCanvas(canvas, cropData);
      var xhr = new XMLHttpRequest(),
        formData = new FormData();
      formData.append('data', getCanvasImageData(canvas));
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

  var _isInPreviewPopup = function (event) {
    return _isAncestor(previewContainer, event.target);
  };

  var startCropping = function (event) {
    if (_isLeftButton(event) && !_isInPreviewPopup(event)) {
      if (_canvas !== null) {
        _isCropping = true;
        _selectionRectangle = createSelectionRectangle();
        initializeCropData(event);
        mouseHelper.classList.add("tooltip-visible");
        updateSelectionFromCropData(_selectionRectangle, _cropData);
        event.preventDefault();
      }
    }
  };

  var onDropAreaMousedown = function (event) {
    if (_isLeftButton(event) && event.target == dropArea) {
      // if the target is exactly the drop area, the user is using the scrollbars, stop bubbling
      event.stopPropagation()
    }
  };

  var stopCropping = function (event) {
    if(_isCropping) {
      _isCropping = false;
      var absoluteData = calculateAbsoluteCropData(_cropData, _canvas.parentNode);

      mouseHelper.classList.remove("tooltip-visible");
      cropImageAndUpload(_canvas, absoluteData, onSaveCompleted);
    }
  };

  window.addEventListener("mouseup", stopCropping);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("paste", onPasteEvent);
  dropArea.addEventListener("mousedown", onDropAreaMousedown);
  window.addEventListener("mousedown", startCropping);

  window.dismissPreview = dismissPreview;
  window.copyToClipboard = copyToClipboard;
})();
