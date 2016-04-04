describe Order do

  context "attributes" do

      it "generates UUID before validation on_create" do
        @order = Order.new
        @order.valid?
        @order.uuid.should_not be_nil
      end

      it { Order.primary_key.should == 'uuid' }

    end

  context "class methods" do

    let(:first_order) { Order.fill!(@options) }
    let(:second_order) { Order.fill!(@options) }

    before do
      @options = {
        name: 'marin',
        user_id: 12983,
        price: 123.12,
        currency: 'usd',
        payment_option_id: 1
      }
    end

    describe ".fill!" do

      it "sets the name" do
        first_order.name.should == @options[:name]
      end

      it "sets user_id" do
        first_order.user_id.should == @options[:user_id]
      end

      it "sets the price" do
        first_order.price.should == @options[:price]
      end

      it "sets the currency" do
        first_order.currency.should == @options[:currency]
      end

      it "sets the payment_option_id" do
        first_order.payment_option_id.should == @options[:payment_option_id]
      end

      it "saves" do
        Order.any_instance.should_receive :save!
        Order.fill!(@options)
      end

      it "uses the right order number" do
        numbah = Order.next_order_number
        first_order.number.should == numbah
      end

    end

    describe ".next_order_number" do

      subject { Order.next_order_number }

      context "there is at least one order" do
        let(:last_record) { double :last_record, number: 1 }

        before do
          allow(Order).to receive(:count) { 1 }
          allow_any_instance_of(ActiveRecord::Relation).to receive(:first) { last_record }
        end

        it "gives the next number" do
          expect(subject).to eq 2
        end
      end

      context "no orders" do

          before do
            allow(Order).to receive(:count) { 0 }
          end

          it "doesn't break if there's no orders" do
            expect(subject).to_not raise_error
          end

          it "returns 1 if there's no orders" do
            expect(subject).to eq 1
          end

      end

    end

    describe ".percent" do

      it "calculates the percent based on #goal and #revenue" do
        Order.stub(:revenue).and_return(6.2)
        Order.stub(:goal).and_return(2.5)

        Order.percent.should == 2.48 * 100
      end
    end

    describe ".goal" do
      it "returns the project goal from Settings" do
        Order.goal.should == Settings.project_goal
      end
    end

    describe ".revenue" do
      subject { Order.revenue }

      context "when the app settings use payment options" do
        before do
          allow(Settings).to receive(:use_payment_options) { true }
          PaymentOption.create(amount:BigDecimal.new("50.00"), amount_display:'$50', description:'test payment option', id: 1)
        end

        it "sums the total revenue from all orders" do
          first = first_order
          second = second_order
          expect(subject).to eq(first.price + second.price)
        end
      end

      context "when the app settings don't use payment options" do
        before do
          allow(Settings).to receive(:use_payment_options) { false }
        end

        it "sums the total revenue from all orders" do
          first = first_order
          second = second_order
          expect(subject).to eq(first.price + second.price)
        end
      end

    end

    describe ".backers" do
      it "returns the number of orders" do
        Order.delete_all
        Order.fill!(name: 'marin', user_id: 1, price: 123.21, currency: 'usd', payment_option_id: 1)
        Order.backers.should == 1
      end
    end

  end

  describe "validators" do

    it { should validate_presence_of :name }
    it { should validate_presence_of :price }
    it { should validate_presence_of :user_id }

  end

end
