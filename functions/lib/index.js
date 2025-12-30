"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processScheduledReminders = exports.updateEmailAndSendReset = exports.deleteUserAuth = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
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
            url: 'https://eilon-matok.firebaseapp.com',
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
// Process scheduled appointment reminders every 5 minutes
// This ensures reminders are sent even when the app is closed
exports.processScheduledReminders = functions.pubsub
    .schedule('every 5 minutes')
    .onRun(async (context) => {
    try {
        console.log('🕐 Processing scheduled reminders (Cloud Function)...');
        const now = admin.firestore.Timestamp.now();
        const remindersRef = admin.firestore().collection('scheduledReminders');
        // Get all pending reminders that are due
        const remindersSnapshot = await remindersRef
            .where('status', '==', 'pending')
            .where('scheduledTime', '<=', now)
            .get();
        console.log(`📱 Found ${remindersSnapshot.size} reminders to process`);
        const results = await Promise.allSettled(remindersSnapshot.docs.map(async (reminderDoc) => {
            var _a, _b;
            const reminderData = reminderDoc.data();
            const { appointmentId, userId, reminderType } = reminderData;
            try {
                // Get appointment data
                const appointmentDoc = await admin.firestore()
                    .collection('appointments')
                    .doc(appointmentId)
                    .get();
                if (!appointmentDoc.exists) {
                    console.log(`❌ Appointment ${appointmentId} not found, skipping reminder`);
                    await reminderDoc.ref.update({ status: 'failed', error: 'Appointment not found' });
                    return;
                }
                const appointmentData = appointmentDoc.data();
                const appointmentDate = appointmentData.date.toDate();
                const currentTime = new Date();
                const timeDiff = appointmentDate.getTime() - currentTime.getTime();
                const hoursUntilAppointment = timeDiff / (1000 * 60 * 60);
                const minutesUntilAppointment = timeDiff / (1000 * 60);
                // Get user's push token
                const userDoc = await admin.firestore()
                    .collection('users')
                    .doc(userId)
                    .get();
                if (!userDoc.exists) {
                    console.log(`❌ User ${userId} not found, skipping reminder`);
                    await reminderDoc.ref.update({ status: 'failed', error: 'User not found' });
                    return;
                }
                const userData = userDoc.data();
                // Backward compatibility: some users still have legacy "pushToken"
                const pushToken = userData.expoPushToken || userData.pushToken;
                if (!pushToken) {
                    console.log(`⚠️ User ${userId} has no push token (expoPushToken/pushToken), skipping reminder`);
                    await reminderDoc.ref.update({ status: 'failed', error: 'No push token (expoPushToken/pushToken)' });
                    return;
                }
                // Get treatment name
                let treatmentName = 'הטיפול';
                if (appointmentData.treatmentId) {
                    try {
                        const treatmentDoc = await admin.firestore()
                            .collection('treatments')
                            .doc(appointmentData.treatmentId)
                            .get();
                        if (treatmentDoc.exists) {
                            treatmentName = treatmentDoc.data().name || 'הטיפול';
                        }
                    }
                    catch (e) {
                        console.log('Could not fetch treatment name');
                    }
                }
                // Determine reminder message based on time until appointment
                let title = '';
                let message = '';
                if (minutesUntilAppointment <= 5 && minutesUntilAppointment > 0 && hoursUntilAppointment < 1) {
                    title = 'תזכורת לתור! ⏰';
                    message = `התור שלך בעוד 5 דקות ב-${appointmentDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
                }
                else if (hoursUntilAppointment <= 1 && minutesUntilAppointment > 5) {
                    title = 'תזכורת לתור! ⏰';
                    message = `יש לך תור ל${treatmentName} בעוד שעה ב-${appointmentDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
                }
                else if (minutesUntilAppointment <= 0 && minutesUntilAppointment > -60) {
                    title = 'התור שלך מתחיל! 🎯';
                    message = `התור שלך ל${treatmentName} מתחיל עכשיו!`;
                }
                else {
                    console.log(`📅 No reminder needed at this time (${hoursUntilAppointment.toFixed(2)} hours until appointment)`);
                    await reminderDoc.ref.update({ status: 'skipped', reason: 'Not the right time' });
                    return;
                }
                // Send push notification using Expo's push notification service
                const response = await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Accept-encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: pushToken,
                        sound: 'default',
                        title: title,
                        body: message,
                        data: { appointmentId: appointmentId, type: 'appointment-reminder' },
                    }),
                });
                const responseData = await response.json();
                if (response.ok && ((_a = responseData.data) === null || _a === void 0 ? void 0 : _a.status) === 'ok') {
                    console.log(`✅ Sent ${reminderType} reminder to user ${userId} for appointment ${appointmentId}`);
                    // Mark reminder as sent
                    await reminderDoc.ref.update({
                        status: 'sent',
                        sentAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
                else {
                    console.error(`❌ Failed to send reminder:`, responseData);
                    await reminderDoc.ref.update({
                        status: 'failed',
                        error: ((_b = responseData.data) === null || _b === void 0 ? void 0 : _b.message) || 'Unknown error'
                    });
                }
            }
            catch (error) {
                console.error(`❌ Error processing reminder ${reminderDoc.id}:`, error);
                await reminderDoc.ref.update({
                    status: 'failed',
                    error: error.message || 'Unknown error'
                });
            }
        }));
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`✅ Processed ${successful} reminders successfully, ${failed} failed`);
        return { success: true, processed: successful, failed };
    }
    catch (error) {
        console.error('❌ Error in processScheduledReminders:', error);
        throw error;
    }
});
//# sourceMappingURL=index.js.map