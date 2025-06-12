const mongoose = require('mongoose');

// Define the user schema
const userSchema = new mongoose.Schema({
    number: {
        type: String,
    },
    tryLogin: {
        type: Boolean,
        default: false
    },
    otp: {
        type: String,
    },
    otpExpiresAt: {
        type: Date,
    },
    isBlock: {
        type: Boolean,
        default: false,
    },
    email: {
        type: String,
        default: 'Please enter your email address',

    },
    name: {
        type: String,
        default: 'Guest',
    },
    isOtpVerify: {
        type: Boolean,
        default: false
    },
    isGoogle: {
        type: Boolean,
        default: false,
    },
    profileImage: {
        image: {
            type: String

        },
        publicId: {
            type: String
        }
    },
    fcmToken: {
        type: String
    }
}, { timestamps: true });

// Create the model
const User = mongoose.model('User', userSchema);

module.exports = User;
