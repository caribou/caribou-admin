if (typeof window["console"] == 'undefined') {
  var console = {};
  console.log = function () {};
}

var Main = (function(global){
  
  var model_list = global.caribou.model_list(),
      model_detail = global.caribou.model_detail();


  var init = function(){
    var body = document.body;
    var controller = body.getAttribute('data-controller');
    console.log("controller: " + controller);

    try{
      this[controller].init();
    }catch(e){
      console.log('no js controller for this page');
    }
  };
  
  return {
    init: init,
    model_list: model_list,
    model_detail: model_detail
  };
  
})(window);


/*- INITIALIZATION
 ----------------------------------------------------------------------*/
$(document).ready(function(){
  Main.init();
});
