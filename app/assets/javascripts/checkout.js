// this sets the actions/functions/variables that we want executed once the page is finished loading
var ready = function() {
  //this handler var holds the StripeCheckout configuration. We can do this, because we use their JS script, which is loaded on the application.html.erb header tags.
  var handler = StripeCheckout.configure({
    //the public test key
    key: $('.stripe_pk').data('pk'),
    //the image we want to show
    image: $('.imagelink').data('link'),
    //locale settings /lang/country
    locale: 'auto',
    //additional fields we want
    shippingAddress: true,
    billingAddress: true,
    //token function which is what handles the stripe call back and allows us to call whatever we want once it's successful - token is default but we added a second field that can take the shipping&billing addresses
    //in this case we named it args
    token: function(token, args) {
      //here we set the details for the transaction we want to make
      var paymentinfo = setData();
      //actual jQuery ajax call
      $.ajax({
        //the url we're directing this ajax call
              url: '/preorder/order',
        //type of call
              type: "POST",
        //type of data
              dataType: "html",
        //extra data, this will be available on our controller as params. So we'll have, a params[:token], a params[:email], a params[:shipping] and all the contents of the hash "paymentinfo" that was set with "setData()"
              data: {
                token: token.id,
                email: token.email,
                shipping: args,
                paymentinfo
              },
              //this is the sucessful callback
              success: function(data) {
                //data is whatever our app returned to this ajax call. In this particular case we returned a JSON object that we can use so we call another function and pass on the information we just retrieved along with the founder information
                selectDetails(data, paymentinfo['founder']);
              }
      });
    }
  });
  
  
  //does the binding for "payable" and for "button"
  $.each(['payable', 'button'], function() {
    //the actual binding. First we "unbind" then we create a on click event listener
    $('.' + this).unbind().on('click', function(e) {
      $('.chosenoption').removeClass('chosenoption');
      //prevents any default action. So when somebody "clicks" this element "e" is passed as the object of it, if "e" has any fundamental action happening we stop it with preventDefault() - this is a standard JS
      //method;
      e.preventDefault();
      //here we fetch the values for our transaction - we've embedded them in our html
      var description = $(this).data('description');
      var amount = $(this).data('amount');
      //this checks if we are either on the "single" page two options or on the multiple options page
      if (description == "option") {
        //if we are on the multiple we check if there's any choice selected
        if ($("input:checked").length > 0) {
          //if there is we fetch the correct data for making our transaction - we assing the jQuery object corresponding to a selected "input" element to "option"
          var option = $("input:checked");
          //then we can call option.siblings to find the element that is a sibling of the option and has a class of "description", then we find the "strong" tag on it, and we return the Text inside it
          //this was a way I found of passing the values into it
          description = option.siblings('.description').find('strong').text();
          //since this action also fetches ":" we need to remove it, so we call .replace
          description = description.replace(':','');
          //here we fetch the amount
          amount = option.data('amount');
          //here we add the class "chosenoption" so that later when we call the stripe function we can setData() and pick the right info
          option.addClass('chosenoption');
          
        } /* in case there is no checked option */ else {
          // we alert the user and we return false, halting this function
          alert('You have to choose an option!');
          return false
        }
      } /* in case we are not on the multiple options page */ else {
        // we can assing directly the class of "chosenoption" to $(this), because right now we are inside the ".on" click function, so the "this" refers directly to the button that was clicked, and due to
        // our structue of the html, in the single page with 2 options, the transaction info is embedded directly on the button.
        $(this).addClass('chosenoption');
      }
      

      // here we open stripe popup (this is also part of their library)
      handler.open({
        name: 'ToTheGig',
        //we attribute the description of our transaction that we fetched previously
        description: description,
        //the amount we fetched previously
        amount: amount,
        //and we set that we want the addresses to be included in the form - probably this can be set only on the handler
        shippingAddress: true,
        billingAddress: true
      });
      
    });
    
    // Close Checkout on page navigation
    $(window).on('popstate', function() {
      handler.close();
    });
  });
  
  $("input[name='gender']").change(function(e) {
    var source = $(this).val().toLowerCase();
    var old = source == 'male' ? 'female' : 'male';
    $('div[class$=' + old + '_size]').hide();
    $('select[name=size_' + old + ']').prop('disabled', true);
    $('select[name=size_' + source + ']').prop('disabled', false);
    $('.' + source + '_size').show(100);
  });
};

function build_options(data, shipping) {
  $.each(data, function (index, gender) {
    var gender_type = gender['gender'];
    var sizes = gender['available'];
    $('#color_holder').append('<div class="gender_available" id="' + gender_type + '"></div>');
    $('select[name="size_' + gender_type + '"]').html('');
    $.each(sizes, function (index, value) {
        $('select[name="size_' + gender_type + '"]').append($('<option/>', { 
            value: value,
            text : value.toUpperCase()
        }));
        $('#' + gender_type).append('<div class="column-flex" id="size_' + value + '_' + gender_type + '"></div>');
        $.each(gender[value], function (index, color) {
          $('#size_' + value + '_' + gender_type).append('<div class="color-choice" style="background-color: #' + color['hex'] + '" data-choice="' + color['name'] + '" data-gender="' + gender_type + '" data-size="' + value + '"></div>');
        });
    });
  });
  $('.color-choice').off('click').on('click', function() {
    var color = $(this).data('choice');
    var size = $(this).data('size');
    var gender = $(this).data('gender');
    scalablepressPlaceOrder(color, size, gender, shipping);
  });
  $.magnificPopup.open({
    items: {
      src: "#select_details"
    },
    type: 'inline',
    modal: true
  }, 0);
  
	$(document).on('click', '.confirm_select_modal', function (e) {
    var gender = $('input[name=gender]:checked').val().toLowerCase();
    var size = $('select[name=size_' + gender + ']').val().toLowerCase();
    $('#submit_holder').hide(200, 'swing');
    $('#details_holder').hide(200, 'swing');
    $('#color_holder').append('<div id="back_holder"><button class="back_select">Back</button></div>');
    $('.back_select').off('click').on('click', function(){
      $('#color_holder').hide(200, 'swing');
      $('#' + gender).hide(0).find('#size_' + size + '_' + gender).hide(0);
      $('#submit_holder').show(0);
      $('#details_holder').show(400, 'swing');
      $('#back_holder').remove();
    });
    $('#' + gender).show(0).find('#size_' + size + '_' + gender).show(0);
    $('#color_holder').show(400, 'swing');
	});
	$(document).on('click', '.close_select_modal', function (e) {
    $.magnificPopup.close();
	});
}

//this functions relies on our previous assignment of "chosenoption" to figure out the correct data we need for the transaction
function setData() {
  //here we create a variable _this and we assign it the jquery object with the class "chosenoption" - remember we had two different ways depending on which kind of page we were, so we chose to standardize the first part of the interaction by making sure that "chosenoption" falls on the right element so we don't have to worry with that anymore.
  var _this = $('.chosenoption')
  //here we fetch the amount
  var amount = _this.data('amount');
  //here the description
  var description = _this.data('description');
  //here the id - mostly important for the multi options page
  var p_id = _this.data('option');
  //if the option is regarding the "founder" but can be used in any option that offers a t-shirt
  var founder = _this.data('special')
  //here we build the hash that we want to return so that we can something somewhere else in our code like var something = setData(); which creates a something variable with this hash
  var information = {
    amount: amount,
    description: description,
    p_id: p_id,
    founder: founder
  };
  // unlike Ruby and Rails, Javascript doesn't implicitly return the last assignment/function executed so we have to explicitly "return" the information hash, so that it bubbles up and ends up in our variable assignment we called somewhere else. If you take - return information; - from here, you break our system.
  return information;
};


//this is the function that gets called once we receive a success callback from our ajax for creating a stripe charge, as you see it takes two values - data is what was returned by our app and founder is simple a boolean var stating if this payment includes a t-shirt order or not.
function selectDetails(data, founder) {
  //since we returned the data as a "json" object from our back-end we need to parse it so we can access it as a regular object.
  data = JSON.parse(data);
  console.log(data);
  //here we check if the payment included a t-shirt (we pass this value previously of course)
  if (founder == "founder") {
    var shipping = format_address(data['shipping']);
    $.ajax({
            url: '/preorder/scalablepresscall',
            type: "POST",
            dataType: "html",
            success: function(data) {
              data = JSON.parse(data);
              //console.log(data);
              build_options(data, shipping);
            }
    });
  } /* in case this callback wasn't from an option that offered a tee, we simply redirect the user to the "share" path we also retrieved through the api */ 
  else {
    window.location.href = data['path'];
  }
};

//this is a simple function used to format the address. Since we have the data hash we sent through our back-end, we can safely create those values and simply return them.
function format_address(shipping) {
  return {
    names: shipping['shipping_name'],
    country: shipping['shipping_address_country_code'],
    address: shipping['shipping_address_line1'],
    state: shipping['shipping_address_state'],
    city: shipping['shipping_address_city'],
    zip: shipping['shipping_address_zip']
  }
}

function scalablepressPlaceOrder(color, size, gender, shipping) {
  $.ajax({
          url: '/preorder/scalablepressorder',
          type: "POST",
          dataType: "html",
          data: {
            color: color,
            size: size,
            gender: gender,
            shipping: shipping
          },
          success: function(data) {
            //and we just redirect the window to the path we'll get as an answer from our back-end - switch batch to preorder_controller.api to follow through
            data = JSON.parse(data);
            //console.log(data)
            window.location.href = data['path'];
          }
  });
};

//this is a jquery function I found. Together with the isMobile code below it finds if the user agent viewing the page is mobile, and if it is, adds a css class named smalldisplay which I used in CSS to format it correctly with padding for mobile viewing
jQuery(function($) {
  if (isMobile.any()) {
    $('.maincontent').addClass('smalldisplay');
    $(document).ready(ready);
  } else if (!isMobile.any()) {
    $('.maincontent').removeClass('smalldisplay');
  }
});


var isMobile = { 
Android: function() { return navigator.userAgent.match(/Android/i); }, 
BlackBerry: function() { return navigator.userAgent.match(/BlackBerry/i); }, 
iOS: function() { return navigator.userAgent.match(/iPhone|iPad|iPod/i); }, 
Opera: function() { return navigator.userAgent.match(/Opera Mini/i); }, 
Windows: function() { return navigator.userAgent.match(/IEMobile/i); }, 
any: function() { return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows()); } };

//here is simply two statements saying that whenever an ajax call starts on this "document", we create a spinner on the element with class "glass". I've put this element hidden, so we need to show it also
//this spin JS is magic in the sense that you don't need to worry with the code. You can nonetheless check it yourself as the js is on javascripts assets folder. Calling .spin() on an element 
//creates a spinner with the color: that has been defined for that element. I also created the css for glass by making it start both at top and left 5% before the screen, and then extending it 110% down
//and to the right. This way it covers completely the whole screen. I gave it a very high z-index so that it sits above everything and doesn't allow the user to interect with the page in any way.
$(document).ajaxStart(function(){
  $('.glass').show(400, 'swing', function() {
    $('.glass').spin(); 
  });
});

//here we do the inveres of the ajaxStart. We say that whenever an ajax call finishes, we hide the element with class "glass" and we stop the spinner. simply by calling .spin(false) on an element where
//we previously called .spin(). This is too many magic and vodoo happening but it's also part of how we can build things more quickly
$(document).ajaxStop(function(){ 
  $('.glass').hide(400, 'swing', function() {
      $('.glass').spin(false);  
  });
});

//here we say that when the "document" (page) is completely loaded (ready) to execute the var ready, that we had assigned on top. so if the page is loaded, the DOM is loaded, we can initiate our stripe
//and assign the on click handlers
$(document).ready(ready);

