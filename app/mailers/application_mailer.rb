class ApplicationMailer < ActionMailer::Base
  default from: ENV['MAILGUN_FROM']
  layout 'mailer'
end
