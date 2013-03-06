(function(global){
  function model_list(){
    var init = function(){
      console.log('models list init');
    };

    return {
      init: init 
    };
  }

  global.caribou = global.caribou || {};
  global.caribou.model_list = model_list;

})(window);
