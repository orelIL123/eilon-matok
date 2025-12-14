"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEmailAndSendReset = exports.deleteUserAuth = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
exports.deleteUserAuth = functions.https.onCall(async (data, context) => {
    var _a, _b;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const callerUid = context.auth.uid;
    const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
    if (!callerDoc.exists || !((_a = callerDoc.data()) === null || _a === void 0 ? void 0 : _a.isAdmin)) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can delete users');
    }
    const { userId } = data;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'userId is required');
    }
    try {
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        if (userDoc.exists && ((_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.isAdmin)) {
            throw new functions.https.HttpsError('permission-denied', 'Cannot delete admin users');
        }
        await admin.auth().deleteUser(userId);
        console.log(`✅ Deleted user ${userId} from Authentication`);
        return { success: true, message: 'User deleted from Authentication' };
    }
    catch (error) {
        if (error.code === 'auth/user-not-found') {
            return { success: true, message: 'User already deleted' };
        }
        throw new functions.https.HttpsError('internal', `Failed: ${error.message}`);
    }
});
// Update user email and send password reset link
// This allows users who registered with phone to reset password via any email
exports.updateEmailAndSendReset = functions.https.onCall(async (data) => {
    const { firestoreUserId, newEmail } = data;
    // Validate input
    if (!firestoreUserId) {
        throw new functions.https.HttpsError('invalid-argument', 'firestoreUserId is required');
    }
    if (!newEmail) {
        throw new functions.https.HttpsError('invalid-argument', 'newEmail is required');
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid email format');
    }
    try {
        // Get user document from Firestore to find their Auth UID
        const userDoc = await admin.firestore().collection('users').doc(firestoreUserId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found in database');
        }
        const userData = userDoc.data();
        // The Firestore document ID is typically the same as Firebase Auth UID
        // But some users might have a separate authUid field
        const authUid = (userData === null || userData === void 0 ? void 0 : userData.authUid) || firestoreUserId;
        console.log(`📧 Updating email for user ${authUid} to ${newEmail}`);
        // Update user's email in Firebase Auth
        await admin.auth().updateUser(authUid, {
            email: newEmail.toLowerCase(),
            emailVerified: false
        });
        console.log(`✅ Email updated in Firebase Auth`);
        // Update email in Firestore as well
        await admin.firestore().collection('users').doc(firestoreUserId).update({
            email: newEmail.toLowerCase(),
            emailUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Email updated in Firestore`);
        // Generate password reset link
        // This triggers Firebase to send a password reset email automatically
        // Using Firebase's default domain which is already allowlisted
        const actionCodeSettings = {
            url: 'https://gal-shemesh.firebaseapp.com',
            handleCodeInApp: false
        };
        // generatePasswordResetLink generates a link that Firebase will use
        // When called, Firebase Auth sends the password reset email automatically
        // to the email address provided
        await admin.auth().generatePasswordResetLink(newEmail.toLowerCase(), actionCodeSettings);
        console.log(`✅ Password reset link generated and email sent to ${newEmail}`);
        return {
            success: true,
            message: 'Password reset email sent successfully',
            email: newEmail.toLowerCase()
        };
    }
    catch (error) {
        console.error('❌ Error in updateEmailAndSendReset:', error);
        if (error.code === 'auth/user-not-found') {
            throw new functions.https.HttpsError('not-found', 'User not found in Firebase Auth');
        }
        if (error.code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError('already-exists', 'This email is already in use by another account');
        }
        if (error.code === 'auth/invalid-email') {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid email address');
        }
        throw new functions.https.HttpsError('internal', `Failed: ${error.message}`);
    }
});
//# sourceMappingURL=index.js.map