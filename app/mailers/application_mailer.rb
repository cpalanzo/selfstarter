class ApplicationMailer < ActionMailer::Base
  default from: Settings.mailgun_from
  layout 'mailer'
end
