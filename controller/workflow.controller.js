import { createRequire } from 'module';
import dayjs from 'dayjs';
import Subscription from '../model/subscription.model.js'; // Ensure .js extension

const require = createRequire(import.meta.url);
const { serve } = require('@upstash/workflow/express'); 

const REMINDERS = [7, 5, 2, 1];

export const sendReminders = serve(async (context) => {
    const { subscriptionId } = context.requestPayload;
    const subscription = await fetchSubscription(context, subscriptionId);

    // 1. Fix: Ensure 'active' is a string and subscription exists
    if (!subscription || subscription.status !== 'active') return;

    const renewalDate = dayjs(subscription.renewalDate);

    // 2. Stop if renewal date is in the past
    if (renewalDate.isBefore(dayjs())) {
        console.log(`Renewal date has passed for subscription ${subscriptionId}. Stopping workflow.`);
        return;
    }

    for (const daysBefore of REMINDERS) {
        const reminderDate = renewalDate.subtract(daysBefore, 'day');

        // 3. Only schedule if the reminder date is still in the future
        if (reminderDate.isAfter(dayjs())) {
            // Fix: Pass reminderDate to the helper
            await sleepUntilReminder(context, `Reminder ${daysBefore} days before`, reminderDate);
            
            // 4. Re-check status after waking up (User might have cancelled during sleep)
            const updatedSub = await fetchSubscription(context, subscriptionId);
            
            if (updatedSub && updatedSub.status === 'active') {
                await triggerReminder(context, `${daysBefore} days before renewal reminder`);
            }
        }
    }
});

// --- HELPER FUNCTIONS ---

const sleepUntilReminder = async (context, label, date) => {
    // date is a dayjs object
    console.log(`Sleeping until ${label} at ${date.format()}`);
    await context.sleepUntil(label, date.toDate());
}

const triggerReminder = async (context, label) => {
    return await context.run(label, () => {
        console.log(`Triggering ${label}`);
        // This is where your email sending logic (Resend/Nodemailer) goes
    })
}

const fetchSubscription = async (context, subscriptionId) => {
    return await context.run('get subscription', async () => {
        return await Subscription.findById(subscriptionId).populate('user', 'name email');
    })
}