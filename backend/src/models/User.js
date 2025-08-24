/**
 * User Model
 * Defines the user schema for authentication and authorization
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  passwordHash: {
    type: String,
    required: false, // Made optional for Firebase auth
    select: false // Don't include in queries by default
  },
  // Firebase-specific fields
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true // Allows null values while maintaining uniqueness
  },
  provider: {
    type: String,
    enum: ['local', 'google.com', 'firebase'],
    default: 'local'
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: 100
  },
  photoURL: {
    type: String,
    trim: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  role: {
    type: String,
    enum: ['user', 'analyst', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profile: {
    preferences: {
      theme: {
        type: String,
        enum: ['light', 'dark'],
        default: 'dark'
      },
      notifications: {
        type: Boolean,
        default: true
      },
      securityLevel: {
        type: String,
        enum: ['basic', 'standard', 'advanced'],
        default: 'standard'
      }
    },
    avatar: String,
    bio: String
  },
  security: {
    lastPasswordChange: {
      type: Date,
      default: Date.now
    },
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    accountLockedUntil: Date,
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: String,
    recoveryTokens: [String]
  },
  activity: {
    lastActiveAt: {
      type: Date,
      default: Date.now
    },
    loginHistory: [{
      timestamp: Date,
      ipAddress: String,
      userAgent: String,
      success: Boolean
    }]
  },
  permissions: {
    canAnalyze: {
      type: Boolean,
      default: true
    },
    canExport: {
      type: Boolean,
      default: false
    },
    canManageUsers: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.passwordHash;
      delete ret.security.twoFactorSecret;
      delete ret.security.recoveryTokens;
      return ret;
    }
  }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Instance method to check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.security.accountLockedUntil && this.security.accountLockedUntil > Date.now());
};

// Instance method to increment failed login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.security.accountLockedUntil && this.security.accountLockedUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        'security.accountLockedUntil': 1,
      },
      $set: {
        'security.failedLoginAttempts': 1,
      }
    });
  }
  
  const updates = { $inc: { 'security.failedLoginAttempts': 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.security.failedLoginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { 'security.accountLockedUntil': Date.now() + 2 * 60 * 60 * 1000 };
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      'security.failedLoginAttempts': 1,
      'security.accountLockedUntil': 1
    }
  });
};

// Instance method to log login activity
userSchema.methods.logLogin = function(ipAddress, userAgent, success = true) {
  this.activity.loginHistory.push({
    timestamp: new Date(),
    ipAddress,
    userAgent,
    success
  });
  
  // Keep only last 50 login records
  if (this.activity.loginHistory.length > 50) {
    this.activity.loginHistory = this.activity.loginHistory.slice(-50);
  }
  
  if (success) {
    this.activity.lastActiveAt = new Date();
  }
  
  return this.save();
};

// Pre-save middleware to update permissions based on role
userSchema.pre('save', function(next) {
  if (this.isModified('role')) {
    switch (this.role) {
      case 'admin':
        this.permissions.canAnalyze = true;
        this.permissions.canExport = true;
        this.permissions.canManageUsers = true;
        break;
      case 'analyst':
        this.permissions.canAnalyze = true;
        this.permissions.canExport = true;
        this.permissions.canManageUsers = false;
        break;
      case 'user':
      default:
        this.permissions.canAnalyze = true;
        this.permissions.canExport = false;
        this.permissions.canManageUsers = false;
        break;
    }
  }
  next();
});

// Index for efficient queries (email index is already created by unique: true)
userSchema.index({ 'activity.lastActiveAt': 1 });
userSchema.index({ role: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;