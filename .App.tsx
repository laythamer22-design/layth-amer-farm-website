import { PrismaClient } from '@prisma/client';
import { OpenAI } from "openai";

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class FarmManager {
  
  // أولاً: معالجة الحجوزات مع الشروط الجديدة
  async createBooking(data: any) {
    const selectedDate = new Date(data.date);
    const dayOfWeek = selectedDate.getDay(); // 5 = الجمعة، 6 = السبت

    // شرط إجباري: عائلة أم شباب؟
    if (!data.visitorType || (data.visitorType !== 'عائلة' && data.visitorType !== 'شباب')) {
      throw new Error("يجب اختيار فئة الزوار (عائلة أو شباب).");
    }

    // شرط الحجز التجريبي: منع الجمعة والسبت
    if (data.type === 'TRIAL' && (dayOfWeek === 5 || dayOfWeek === 6)) {
      throw new Error("الحجز التجريبي غير متاح يومي الجمعة والسبت.");
    }

    return await prisma.booking.create({
      data: {
        date: selectedDate,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        visitorType: data.visitorType,
        type: data.type,
        identityUrl: data.identityUrl,
        receiptUrl: data.type === 'STANDARD' ? data.receiptUrl : null,
      }
    });
  }

  // ثانياً: بوت الذكاء الاصطناعي الذي يقرأ من لوحة تحكم المالك
  async askBot(question: string) {
    const settings = await prisma.farmSettings.findUnique({ where: { id: 1 } });
    const info = settings?.farmKnowledge || "مرحبا بك في المزرعة.";

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: `أنت موظف المزرعة. معلوماتك: ${info}. يجب أن تسأل الزبون دائماً هل هم عائلة أم شباب.` },
        { role: "user", content: question }
      ]
    });
    return aiResponse.choices[0].message.content;
  }

  // ثالثاً: لوحة التحكم (للمالك فقط لتعديل المعلومات)
  async updateFarmInfo(newInfo: string) {
    return await prisma.farmSettings.upsert({
      where: { id: 1 },
      update: { farmKnowledge: newInfo },
      create: { id: 1, farmKnowledge: newInfo }
    });
  }
}
