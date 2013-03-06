(function(global){
  function model_detail(){

    var Server = instrument.util.Server(),
    attr_model = $('#attribute-detail');

    var init = function(){
      console.log('models detail init');
      $('.edit').click(function(){
        var th = $(this);
        var tr = th.closest('tr');
        var model_id = tr.data('model-id');
        var attr_id = tr.data('attr-id');
        var name = tr.data('name');

        attr_model.find('h3').text(name);
        edit_attribute(model_id, attr_id);
      });
    };

    function edit_attribute(model_id, attr_id){
      Server.fetchData('http://localhost:33663/settings/models/12/attribute/171', function(data){
        console.log('success');
        console.log(data);
      });
    }

    function save_attribute(){

    }
    
    function delete_attribute(){

    }

    return {
      init: init 
    };
  }

  global.caribou = global.caribou || {};
  global.caribou.model_detail = model_detail;

})(window);
