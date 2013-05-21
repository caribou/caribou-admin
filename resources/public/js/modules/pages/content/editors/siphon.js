(function (global) {
  global.caribou = global.caribou || {};
  var editors = global.caribou.editors;
  if (!editors) {
    throw "editors/base.js and editors/fields.js have not been included";
  }

  function SiphonEditor(options) {
    editors.ModelEditor.call(options);
  }

  $.extend( SiphonEditor.prototype, editors.ModelEditor.prototype, {

  });

  global.caribou.editors.registry.register("siphon", SiphonEditor);
  global.caribou.editors.SiphonEditor = SiphonEditor;
})(window);
