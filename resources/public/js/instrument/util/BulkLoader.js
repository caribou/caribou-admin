/* Takes an array of images and loads them sequentially.
 * Callback is called after each image load.
 * delay is optional param to space timing between callback calls.
 */

(function(global){
  function BulkLoader(){

    var loadSequential = function(imgArr, callBack, delay){

      if(!delay){
        delay = 300;
      }

      function loadImg(img){
        var loader = new Image();
        loader.onload = function(){
          if(callBack){
            callBack(img);
          }

          if(imgArr.length){
            setTimeout(function(){ 
              loadImg(imgArr.shift()); 
            }, delay);
          }
        };

        loader.src = img.src;
      }

      loadImg(imgArr.shift());
    };

    return {
      loadSequential: loadSequential
    };
  }

  global.instrument = global.instrument || {};
  global.instrument.util = global.instrument.util || {};
  global.instrument.util.BulkLoader = BulkLoader;

})(window);
