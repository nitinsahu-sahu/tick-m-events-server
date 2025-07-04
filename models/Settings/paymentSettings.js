const mongoose = require("mongoose");
const { Schema } = mongoose;

const PaymentMethodType = {
  CreditCard: "credit_card",
  MobileMoney: "mobile_money",
  BankTransfer: "bank_transfer",
};

const paymentSettingsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // Payment method type: credit_card, mobile_money, bank_transfer
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethodType),
      required: true,
    },

    // Optional provider/type: e.g., 'mtn', 'orange', 'visa', 'ecobank'
    method: {
      type: String,
      required: true,
    },

    // Details depend on method
    details: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("PaymentSettings", paymentSettingsSchema);
