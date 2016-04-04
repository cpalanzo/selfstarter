require 'spec_helper'
describe PreorderController do

  [:index, :checkout].each do |method|
    it "should get #{method}" do
      response.should be_success
    end

  end
end
