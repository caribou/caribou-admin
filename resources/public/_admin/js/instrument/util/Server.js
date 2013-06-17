(function (global){

  function Server(){
    var server = function(url, type, data_type, data, success) {
      $.ajax({
        type: type,
        url: url,
        dataType: data_type,
        data: data,
        success: function(result) {
          if (success) success(result);  
        }
      });
    }

    var fetchData = function(url, success){
      server(url, "get", "json", null, success);
    };

    return {
      server: server,
      fetchData: fetchData
    };
  }

  global.instrument = global.instrument || {};
  global.instrument.util = global.instrument.util || {};
  global.instrument.util.Server = Server;

})(window);
