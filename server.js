// server.js (الكود الكامل والنهائي مع جميع نقاط النهاية الجديدة والقديمة)

const express = require('express');
const fs = require('fs/promises'); 
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 5000; 
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// مسارات ملفات البيانات الجديدة
const DATA_DIR = path.join(__dirname, 'data');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json'); // طلبات المساعدين
const CODES_FILE = path.join(DATA_DIR, 'codes.json');       // أكواد الدخول
const COMPLAINTS_FILE = path.join(DATA_DIR, 'complaints.json'); // الشكاوى
const EMERGENCY_FILE = path.join(DATA_DIR, 'emergency.json'); // الطوارئ
const HOTELS_FILE = path.join(DATA_DIR, 'hotels.json');       // الفنادق
const RESTAURANTS_FILE = path.join(DATA_DIR, 'restaurants.json'); // المطاعم

// --- وظائف مساعدة للقراءة والكتابة ---
async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT' || error.message.includes('Unexpected end of JSON input')) {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, '[]', 'utf8');
            return [];
        }
        throw error;
    }
}

async function writeJsonFile(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// --- تهيئة Multer لرفع الملفات ---
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const reqId = req.body.requestId || Date.now().toString().slice(-6); 
        cb(null, `${reqId}_${file.fieldname}_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage: storage });

// --- إعدادات السيرفر ---
app.use(express.static(path.join(__dirname, ''))); 
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.json()); 

// --- وظيفة التحقق من صلاحية المدير ---
function checkManagerAuth(req, res, next) {
    const { username, password } = req.body;
    if (username === 'Abdu' && password === '1422010') {
        next(); // السماح بالمرور
    } else {
        res.status(401).json({ success: false, message: 'بيانات المدير غير صحيحة.' });
    }
}

// --- نقاط النهاية الجديدة والقديمة ---

// 📝 [POST] /api/apply: إرسال طلب انضمام جديد (بإضافة حقل اللغة)
app.post('/api/apply', upload.any(), async (req, res) => {
    try {
        const requests = await readJsonFile(REQUESTS_FILE);
        const requestId = Date.now().toString().slice(-6);
        
        const filesMap = req.files ? req.files.reduce((acc, file) => {
            acc[file.fieldname] = file.filename;
            return acc;
        }, {}) : {};

        const newRequest = {
            requestId: requestId,
            timestamp: new Date().toISOString(),
            status: 'pending', 
            name: req.body.name,
            phone: req.body.phone,
            address: req.body.address,
            job: req.body.job,
            language: req.body.language, // حقل اللغة الجديد
            files: filesMap, 
            completeData: null 
        };
        
        requests.push(newRequest);
        await writeJsonFile(REQUESTS_FILE, requests);

        res.json({ success: true, requestId: newRequest.requestId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error saving data.' });
    }
});

// 🔍 [GET] /api/status: الاستعلام عن حالة طلب
app.get('/api/status', async (req, res) => {
    try {
        const requests = await readJsonFile(REQUESTS_FILE);
        const request = requests.find(r => r.requestId === req.query.id);
        if (request) {
            res.json({ success: true, status: request.status, requestId: request.requestId, completeData: request.completeData });
        } else {
            res.status(404).json({ success: false, message: 'لم يتم العثور على رقم الطلب.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// 📋 [POST] /api/complete: استكمال البيانات الإضافية
app.post('/api/complete', upload.single('file_personal_photo'), async (req, res) => {
    try {
        const requests = await readJsonFile(REQUESTS_FILE);
        const requestIndex = requests.findIndex(r => r.requestId === req.body.requestId);

        if (requestIndex !== -1 && requests[requestIndex].status === 'accepted') {
            requests[requestIndex].completeData = {
                work_schedule: req.body.work_schedule,
                max_tourists: req.body.max_tourists,
                meeting_location: req.body.meeting_location,
                experience_summary: req.body.experience_summary,
                personal_photo: req.file ? req.file.filename : null 
            };
            requests[requestIndex].status = 'completed'; 
            
            await writeJsonFile(REQUESTS_FILE, requests);
            res.json({ success: true });
        } else if (requestIndex !== -1 && requests[requestIndex].status !== 'accepted') {
             res.status(400).json({ success: false, message: 'لا يمكن استكمال البيانات، حالة الطلب غير "مقبول".' });
        }
        else {
            res.status(404).json({ success: false, message: 'الطلب غير موجود.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error saving data.' });
    }
});

// --- API لبيانات المستخدمين (أكواد الدخول) ---
// [POST] /api/verifyTicketCode: التحقق من كود التذكرة للدخول
app.post('/api/verifyTicketCode', async (req, res) => {
    try {
        const codes = await readJsonFile(CODES_FILE);
        const code = codes.find(c => c.code === req.body.code && c.used === false);
        
        if (code) {
            // يمكن تعديل used = true; إذا أردت استخدام الكود لمرة واحدة
            res.json({ success: true, message: 'تم التحقق بنجاح.' });
        } else {
            res.status(401).json({ success: false, message: 'كود التذكرة غير صالح أو مستخدم.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// --- API الطوارئ والشكاوى ---
// [POST] /api/submitComplaint: إرسال شكوى/اقتراح
app.post('/api/submitComplaint', async (req, res) => {
    try {
        const complaints = await readJsonFile(COMPLAINTS_FILE);
        const newComplaint = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            name: req.body.name,
            phone: req.body.phone,
            message: req.body.message,
            status: 'new'
        };
        complaints.push(newComplaint);
        await writeJsonFile(COMPLAINTS_FILE, complaints);
        res.json({ success: true, message: 'تم استلام الاقتراح/الشكوى بنجاح.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error saving data.' });
    }
});

// [POST] /api/emergency: استقبال حالة طوارئ
app.post('/api/emergency', async (req, res) => {
    try {
        const emergencies = await readJsonFile(EMERGENCY_FILE);
        const newEmergency = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            location: req.body.location, 
            contact: req.body.contact,   
            status: 'new'
        };
        emergencies.push(newEmergency);
        await writeJsonFile(EMERGENCY_FILE, emergencies);
        res.json({ success: true, message: 'تم إرسال بلاغ الطوارئ إلى الإدارة.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});


// --- API الإدارة (محمية بواسطة checkManagerAuth) ---

// [POST] /api/managerLogin: نقطة وهمية للتحقق من بيانات الدخول
app.post('/api/managerLogin', checkManagerAuth, (req, res) => {
    res.json({ success: true, message: 'تم الدخول بنجاح.' });
});

// [POST] /api/addTicketCode: إضافة كود تذكرة جديد للمستخدمين
app.post('/api/addTicketCode', checkManagerAuth, async (req, res) => {
    try {
        const codes = await readJsonFile(CODES_FILE);
        const newCode = {
            code: req.body.code,
            expires: req.body.expires || null,
            used: false
        };
        codes.push(newCode);
        await writeJsonFile(CODES_FILE, codes);
        res.json({ success: true, message: 'تمت إضافة كود التذكرة بنجاح.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// [GET] /api/requests: عرض طلبات المساعدين
app.get('/api/requests', async (req, res) => {
    // يجب تطبيق حماية في الواجهة الأمامية
    try {
        const requests = await readJsonFile(REQUESTS_FILE);
        res.json(requests);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// [GET] /api/complaints: عرض الشكاوى والاقتراحات
app.get('/api/complaints', async (req, res) => {
    // يجب تطبيق حماية في الواجهة الأمامية
    try {
        const complaints = await readJsonFile(COMPLAINTS_FILE);
        res.json(complaints);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// [GET] /api/emergencies: عرض بلاغات الطوارئ
app.get('/api/emergencies', async (req, res) => {
    // يجب تطبيق حماية في الواجهة الأمامية
    try {
        const emergencies = await readJsonFile(EMERGENCY_FILE);
        res.json(emergencies);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// [POST] /api/updateStatus: تحديث حالة طلب مساعد
app.post('/api/updateStatus', async (req, res) => {
    // يجب تطبيق حماية في الواجهة الأمامية
    const { requestId, status } = req.body;
    try {
        const requests = await readJsonFile(REQUESTS_FILE);
        const request = requests.find(r => r.requestId === requestId);
        if (request) {
            request.status = status;
            await writeJsonFile(REQUESTS_FILE, requests);
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: 'الطلب غير موجود.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// --- API إدارة الفنادق والمطاعم ---

// [POST] /api/hotels: إضافة فندق جديد (المعلومات التي ذكرتها)
app.post('/api/hotels', checkManagerAuth, async (req, res) => {
    try {
        const hotels = await readJsonFile(HOTELS_FILE);
        const newHotel = {
            id: Date.now().toString(),
            name: req.body.name,
            location: req.body.location,
            map_link: req.body.map_link,
            price_night: req.body.price_night,
            stars: parseInt(req.body.stars),
            includes: req.body.includes,
            rating: 0,
            reviews: []
        };
        hotels.push(newHotel);
        await writeJsonFile(HOTELS_FILE, hotels);
        res.json({ success: true, message: 'تم إضافة الفندق بنجاح.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// [GET] /api/hotels: عرض الفنادق للمستخدمين
app.get('/api/hotels', async (req, res) => {
    try {
        const hotels = await readJsonFile(HOTELS_FILE);
        res.json(hotels);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// [POST] /api/hotels/review: إضافة تقييم لفندق
app.post('/api/hotels/review', async (req, res) => {
    try {
        const hotels = await readJsonFile(HOTELS_FILE);
        const hotelIndex = hotels.findIndex(h => h.id === req.body.hotelId);

        if (hotelIndex !== -1) {
            const newReview = {
                username: req.body.username || 'Anonymous',
                rating: parseInt(req.body.rating),
                comment: req.body.comment,
                timestamp: new Date().toISOString()
            };
            hotels[hotelIndex].reviews.push(newReview);
            
            // تحديث متوسط التقييم
            const totalRating = hotels[hotelIndex].reviews.reduce((sum, review) => sum + review.rating, 0);
            hotels[hotelIndex].rating = (totalRating / hotels[hotelIndex].reviews.length).toFixed(1);
            
            await writeJsonFile(HOTELS_FILE, hotels);
            res.json({ success: true, message: 'تم إضافة التقييم بنجاح.' });
        } else {
            res.status(404).json({ success: false, message: 'الفندق غير موجود.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// --- تشغيل السيرفر ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});