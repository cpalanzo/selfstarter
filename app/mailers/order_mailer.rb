class OrderMailer < ApplicationMailer
  
  def order_notify(info, user, order, founder)
    @info = info
    @user = user
    @order = order
    @founder = founder
    mail(to: user.email, subject: 'Funding Confirmation')
  end
  
  def order_confirmation(info, user, order, founder)
    @info = info
    @user = user
    @order = order
    @founder = founder
    mail(to: ENV['MAILGUN_TO'], subject: 'Someone backed you!')
  end
  
end
