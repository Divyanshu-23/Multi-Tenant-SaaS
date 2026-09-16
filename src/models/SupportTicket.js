const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 3000 },
  category: { type: String, enum: ['account', 'property', 'enquiry', 'technical', 'other'], default: 'other' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open' },
}, { timestamps: true });

supportTicketSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
