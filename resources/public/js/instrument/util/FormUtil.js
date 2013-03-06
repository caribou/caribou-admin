/*
data-attribute keys:

data-required = has to have value other then default
data-email = has to have valid email
data-phone = has to have valid phone number
data-number = has to be a number
data-date = has to be a valid date

data-default = this field has default text that should be cleared when typed into

*/

(function(global){
  function FormUtil(element){
    element = $(element);
    inputs = element.find("input[type=text], textarea");
    addHandlers();
    
    var validate = function(){
      var errors = [];
      errors = checkTextFields();
      
      return errors;
    }
    
    var getForm = function(){
      return element;
    }
    
    var reset = function(input){
      $(input).each(function () {
      	var defText = $(this).attr("data-default");
      	$(this).val(defText);
			});
    }
    
    function addHandlers(){    
      inputs.focus(function(){
        input = $(this);
        
        if(isDefault(input)){
          input.val("") || input.text("");
        }
        
      });
      
      inputs.blur(function(){
        input = $(this);
        
        if(input.attr("data-default")){
          
          if(input.val() == ""){
            console.log(input);
            input.val(input.attr("data-default")) || input.text(input.attr("data-default"));
          }
        }
        
      });
    }
    
    function scrubPattern(pattern){
      pattern = pattern.replace("(", "\\(");
      pattern = pattern.replace(")", "\\)");
      
      return pattern;
    }

    var isDefault = function(input){
      input = $(input);
      
      if(input.attr("data-default")){
        var search = new RegExp("^"+scrubPattern(input.attr("data-default"))+"$");
        if(search.test(input.val()|| input.text())){
          return true;
        }
      }
      
      return false;
    }
    
    function checkTextFields(){
      var errors = [];
      element.find("input[type=text], textarea").each(function(){
        var input = $(this);
        if(input.attr("data-required") == "true" && !input.hasClass("email") && !input.hasClass("webaddress") && !input.hasClass("date")){
          if(input.val() == "" || isDefault(input)){
            var msg = (input.attr("data-error") != "") ?  input.attr("data-error") : "Please enter a value";
            errors.push({input: input, msg:msg})
          }
        }
        
        if(input.hasClass("email")){
          if(input.attr("data-required") == "true") {  
            if(isEmail(input.val()) == false) {
              var msg = (input.attr("data-error") != "") ?  input.attr("data-error") : "Please enter a value";
              errors.push({input: input, msg: msg});
            }
          }else{
            if(isDefault(input) != true){
              if(isEmail(input.val()) == false) {
                var msg = (input.attr("data-error") != "") ?  input.attr("data-error") : "Please enter a value";
                errors.push({input: input, msg: msg});
              }
            }
          }
        }
        
        if(input.hasClass("webaddress")){
          if(isDefault(input) != true || input.attr("data-required") == true){
            if(isUrl(input.val()) == false){
              var msg = (input.attr("data-error") != "") ?  input.attr("data-error") : "Please enter a value";
              errors.push({input: input, msg: msg});
            }
          }
        }
        
        if(input.hasClass("date")){
          console.log("date: " + isValidDate(input.val()));
          if(isValidDate(input.val()) == false){
            var msg = (input.attr("data-error") != "") ?  input.attr("data-error") : "Please enter a value";
            errors.push({input: input, msg: msg});
          }
        }
      
        
      });
      
      return errors;
      
    }
    
    function isUrl(s) {
    	var regexp = /([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/
    	return regexp.test(s);
    }
    
    function isEmail(email) {
      var reg = /^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;
      var address = email
      return reg.test(address);
    }
    
    function isValidDate(s) {
      var regexp = /^(0[1-9]|1[012])[- \/.](0[1-9]|[12][0-9]|3[01])[- \/.](19|20)\d\d$/
      return regexp.test(s);
    }
    
    return {
      validate: validate, 
      getForm: getForm,
      isDefault: isDefault,
      reset: reset
    }; 
  }
  
  global.instrument = global.instrument || {};
  global.instrument.FormUtil = FormUtil;
  
})(window);
