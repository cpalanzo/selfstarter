class PreorderController < ApplicationController
  require 'scalablepressclient' 
  skip_before_action :verify_authenticity_token, :only => :ipn

  require "stripe"
  Stripe.api_key = ENV['STRIPE_PRIVATE_KEY']

  def index
  end
  
  #our small API
  def decide
    case params[:to_action]
    when "order"
      order
    when "scalablepresscall"
      scalablepress_available_options
    when "scalablepressorder"
      scalablepress_order
    end
  end
  

  def checkout
    #@stripe = Stripe.api_key
  end

  def order
    # first we take the parameters that we sent so we can use them. We could use directly params[:xxxx] when setting fields but this way it's more explicit and shorter to write further down.
    # as you can see by the structure of the ajax call, we set token and email field as independent fields, and then we set another field with the paymentinfo. Since the paymentinfo is an hash we need to fetch it
    # by statins params[:paymentinfo], followed by the "key" we want, in this case we want the amount, the description and the option ID.
    token = params[:token]
    email = params[:email]
    amount = params[:paymentinfo][:amount]
    description = params[:paymentinfo][:description]
    p_id = params[:paymentinfo][:p_id]
    founder = params[:paymentinfo][:founder]
    # here what we do is we search our database to check if a user with this email already exists. If it does what we set it to @user, if it doesn't we create a new record on the DB and set it to @user
    @user = User.find_or_create_by(email: email)
    # here we create a customer. This Stripe::Customer.create is available because we include the stripe gem library that has these things already predefined. We create a customer with the email and the charge token we fetched from the stripe callback
    client = Stripe::Customer.create(
      email: email,
      source: token
    )
    # here we create the actual charge. Since we assigned to "client" a new stripe customer object, we are able to retrieve an ID specifically for this customer by calling the method .id on our object (because we have the stripe gem of course). The remaining options are taken from the params we used before.
    charge = Stripe::Charge.create(
      amount: amount,
      currency: 'USD',
      customer: client.id,
      description: description,
    )
    # since stripe requires an integer value to create the charge we have passed the "amount" as an integer (instead of 10$ equating 10.00 it equates to 1000)
    # and that's all nice for stripe but for our database we are using decimals, so we need to convert that in order to fill our DB. This would probably be better to be "consistent" and using the same rules for the DB as our dependencies (stripe) require. But for now it's like this. So we assing to "amount_decimal" the "amount", stripping it from the last 2 characters - [0...-2]. And then we re-assing amount_decimal to itself but we call the method .to_f , which turns an integer into a floating. So we passed for instance 1000 (which is 10$), we turned it into 10, and then with .to_f we made it 10.00. And it's this that gets recorded into the DB
    amount_decimal = amount[0...-2]
    amount_decimal = amount_decimal.to_f
    # in case there's any ERROR on the charge - which shouldn't be happening anyway, we raise an Exception - this is an "hard-brake" on the application. We check if the transaction was successfully by calling the method .paid on our charge object. If it returns true, everything is fine, if it return false we have problems.
    raise Exception.new("Couldn't charge Card. Please try again") unless charge.paid
    #if we reach this point right after the safe-guard clause, it means the charge was completed, so we can now create an hash with all the details we want saved into a new "order" record. The options are quite straightfoward. We had set an user to @user instance variable, so we can use this to return the .id of it. We already converted the amount to decimal, we know the currency is dollars, we have the product name in the settings.yml, we have the id of the payment option and we have the charge.id 
    options = {
      user_id: @user.id,
      price: amount_decimal, #store in decimal in db, not integer
      currency: 'USD',
      name: Settings.product_name,
      payment_option_id: p_id,
      transaction_id: charge.id
    }
    # so now we call a method of our Order model, which is ".fill!" with our hash passed on as argument. what does fill! do? It's not a standard object method. It's defined on the "order" model. If you open it up you can see what it does and it becomes more clear. Basically the "fill!" just creates the actual record on the DB.
    @order = Order.fill!(options)
    # after we created an Order record for this order we update the "stripe_charge_id" on our @user object. The update method saves not only the object it refers to, but also the DB record. This way we also have the corresponding stripe charge in our user record and if in the future we need to use it, like in a back-end to list the associated charges with an user we can call simply @user.stripe_charge_id
    @user.update(stripe_charge_id: charge.id)
    # here we use Rails session object to save an hash containing both the @user.id (so we can use it later, and the order_uuid. The order_uuid is so that we can render the path for sharing and the @user.id is so that in case this charge entails a t-shirt shipping, later on, since each session object is unique to each user active on the wbesite, we can return this :user_order hash from the session to fetch the corresponding user as well as the right sharing path to redirect once the t-shirt process is finished. In case this charge was not including a t-shirt, we pass the share_path() for this specific user/order so that we can redirect the. We also have to render the shipping addresses, so in case we need to ship the t-shirt, we'll have the addresses available. We don't need to check it further because stripe makes sure our addresses are real (at least, country, state, city). So we are confident we can use them with scalable_press api
    session[:user_order] = { user_id: @user.id, order_uuid: @order.uuid }
    unless founder == 'founder'
      send_emails(options, @user, @order)
    end
    # this is the block that responds to the call. We can use format.json, or format.html in this case doesn't matter. The "render json:" says that instead of rendering a view, we render a JSON object, and this is what the success callback in checkout.js will grab under the name "data". So it means we'll have available an hash, named data, with two key-values. One "path" another one "shipping". So now back to the guide document to follow through
    respond_to do |format|
      format.json { render json: { path: share_path(@order.uuid), shipping: params[:shipping] } }
    end
  end


  def share
    @order = Order.find_by(:uuid => params[:uuid])
  end
  
  def scalablepress_available_options
    pf = ScalablepressClient.new
    files = pf.build_availability
    respond_to do |format|
      format.json { render json: files.as_json }
    end
  end
  
  def scalablepress_order
    elements = {}
    shipping = params[:shipping]
    elements[:path] = "quote"
    elements[:gender] = params[:gender]
    elements[:size] = params[:size]
    elements[:color] = params[:color]
    elements[:product] = elements[:gender] == 'male' ? ENV['MALE_MODEL'] : ENV['FEMALE_MODEL']
    elements[:address_name] = shipping[:names]
    elements[:address_address] = shipping[:address]
    elements[:address_city] = shipping[:city]
    elements[:address_state] = shipping[:state]
    elements[:address_zip] = shipping[:zip]
    elements[:address_country] = shipping[:country]
    
    @user = User.find(session[:user_order][:user_id])
    @order = Order.find_by(uuid: session[:user_order][:order_uuid])
    if @order.status == 'fulfilled'
      respond_to do |format|
        format.json { render json: { path: "/" } }
      end
    else
      pf = ScalablepressClient.new
      quote = pf.start_request(elements)
      puts quote
      @user.update(name: shipping[:names], api_order_id: quote[:order_id], order_data: quote[:answer].to_json)
      @order.update(status: 'fulfilled')
      send_emails(quote[:answer], @user, @order, true)
    
      respond_to do |format|
        format.json { render json: { quote: quote, path: share_path(session[:user_order][:order_uuid]) } }
      end
    end
  end
  
  def send_emails(info, user, order, founder=false)
    puts info
    info = JSON.pretty_generate(info)
    OrderMailer.order_notify(info, user, order, founder).deliver_now
    OrderMailer.order_confirmation(info, user, order, founder).deliver_now
  end

  
  def ipn
  end
end
