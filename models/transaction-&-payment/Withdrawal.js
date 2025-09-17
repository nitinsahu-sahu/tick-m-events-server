const mongoose = require("mongoose");
const { Schema } = mongoose;

const PaymentMethodType = {
  CreditCard: 'credit_card',
  MobileMoney: 'mobile_money',
  BankTransfer: 'bank_transfer',
};

const WithdrawalStatus = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
  Completed: 'completed',
};

const withdrawalSchema = new Schema({
  withdrawalId: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  payment: {
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethodType),
      required: true,
    },
    method: {
      type: String, // e.g., 'mtn', 'orange', 'visa', 'ecobank'
      required: true,
    },
    details: {
      type: Schema.Types.Mixed, // keep flexible for now
      required: true,
    },
  },
  status: { type: String, enum: Object.values(WithdrawalStatus), default: WithdrawalStatus.Pending },
  transId: { type: String },
  dateInitiated: { type: Date },
},
  { timestamps: true, }
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
