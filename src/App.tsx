import React, { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Leaf, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Briefcase, 
  Target, 
  CheckCircle2, 
  ChevronRight,
  Sprout,
  Trees,
  Heart,
  Award,
  Send,
  Loader2,
  AlertCircle,
  Download,
  Lock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from './lib/utils';
import { 
  db, 
  collection, 
  addDoc, 
  serverTimestamp, 
  getAllSurveys,
  auth,
  googleProvider,
  signInWithPopup,
  signOut
} from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

// --- Schema Definition ---
const surveySchema = z.object({
  fullName: z.string().min(2, 'Vui lòng nhập họ tên'),
  email: z.string().email('Email không hợp lệ'),
  phone: z.string().optional(),
  address: z.string().min(5, 'Vui lòng nhập địa chỉ'),
  age: z.string().min(1, 'Vui lòng chọn độ tuổi'),
  occupation: z.string().min(1, 'Vui lòng chọn nghề nghiệp'),
  interestedGroup: z.enum(['agriculture', 'bamboo', 'wellness', 'gacp']),
  
  agricultureParticipation: z.string().optional(),
  landArea: z.string().optional(),
  cropTypes: z.array(z.string()).optional(),
  organicFarming: z.string().optional(),
  challenges: z.string().optional(),

  bambooGrowing: z.string().optional(),
  bambooTypes: z.array(z.string()).optional(),
  herbGrowing: z.string().optional(),
  herbTypes: z.array(z.string()).optional(),
  growingPurpose: z.string().optional(),

  wellnessInterest: z.string().optional(),
  wellnessProducts: z.array(z.string()).optional(),
  pricePremium: z.string().optional(),
  purchaseChannel: z.string().optional(),

  gacpKnowledge: z.string().optional(),
  gacpInterest: z.string().optional(),
  gacpBarrier: z.string().optional(),
  gacpTraining: z.string().optional(),

  receiveInfo: z.string().min(1, 'Vui lòng chọn phương thức nhận tin'),
  feedback: z.string().optional(),
});

type SurveyData = z.infer<typeof surveySchema>;

export default function App() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleAdminLogin = () => {
    if (adminPassword === 'ecofarm2026') {
      setIsAdminAuthenticated(true);
      setAdminPassword('');
    } else {
      alert('Mật khẩu không chính xác!');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
      alert("Đăng nhập thất bại!");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleDownloadExcel = async () => {
    if (!user || user.email !== 'mqc.academy@gmail.com') {
      alert("Bạn không có quyền tải dữ liệu. Vui lòng đăng nhập đúng email quản trị.");
      return;
    }

    setIsDownloading(true);
    try {
      const data = await getAllSurveys();
      if (data.length === 0) {
        alert("Chưa có dữ liệu khảo sát nào.");
        return;
      }
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Surveys");
      XLSX.writeFile(workbook, `EcoFarm_Surveys_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error("Error downloading excel:", error);
      alert("Có lỗi xảy ra khi tải dữ liệu. Vui lòng kiểm tra quyền truy cập Firebase.");
    } finally {
      setIsDownloading(false);
    }
  };

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SurveyData>({
    resolver: zodResolver(surveySchema),
    defaultValues: {
      cropTypes: [],
      bambooTypes: [],
      herbTypes: [],
      wellnessProducts: [],
    }
  });

  const interestedGroup = useWatch({ control, name: 'interestedGroup' });
  const allValues = useWatch({ control });

  useEffect(() => {
    const requiredFields: (keyof SurveyData)[] = ['fullName', 'email', 'address', 'age', 'occupation', 'interestedGroup', 'receiveInfo'];
    const filledRequired = requiredFields.filter(field => !!allValues[field]).length;
    
    let groupFieldsCount = 0;
    let groupFilledCount = 0;

    if (interestedGroup === 'agriculture') {
      const fields: (keyof SurveyData)[] = ['agricultureParticipation', 'landArea', 'organicFarming'];
      groupFieldsCount = fields.length;
      groupFilledCount = fields.filter(f => !!allValues[f]).length;
    } else if (interestedGroup === 'bamboo') {
      const fields: (keyof SurveyData)[] = ['bambooGrowing', 'herbGrowing', 'growingPurpose'];
      groupFieldsCount = fields.length;
      groupFilledCount = fields.filter(f => !!allValues[f]).length;
    } else if (interestedGroup === 'wellness') {
      const fields: (keyof SurveyData)[] = ['wellnessInterest', 'pricePremium', 'purchaseChannel'];
      groupFieldsCount = fields.length;
      groupFilledCount = fields.filter(f => !!allValues[f]).length;
    } else if (interestedGroup === 'gacp') {
      const fields: (keyof SurveyData)[] = ['gacpKnowledge', 'gacpInterest', 'gacpBarrier', 'gacpTraining'];
      groupFieldsCount = fields.length;
      groupFilledCount = fields.filter(f => !!allValues[f]).length;
    }

    const total = requiredFields.length + groupFieldsCount;
    const filled = filledRequired + groupFilledCount;
    setProgress((filled / total) * 100);
  }, [allValues, interestedGroup]);

  const onSubmit = async (data: SurveyData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await addDoc(collection(db, 'surveys'), {
        ...data,
        createdAt: serverTimestamp(),
      });
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Error saving survey:', error);
      setSubmitError('Có lỗi xảy ra khi gửi khảo sát. Vui lòng thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full bg-white rounded-3xl p-12 shadow-2xl text-center border border-brand-olive/10">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="serif text-4xl font-bold text-brand-olive mb-4">Cảm ơn bạn!</h2>
          <p className="text-gray-600 mb-8">Dữ liệu khảo sát của bạn đã được gửi thành công vào hệ thống EcoFarm.</p>
          <button onClick={() => setIsSubmitted(false)} className="w-full py-4 bg-brand-olive text-white rounded-full font-medium hover:bg-brand-olive/90 transition-colors">Quay lại trang chủ</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
      <header className="text-center mb-12">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline-flex items-center gap-2 px-4 py-2 bg-brand-olive/10 text-brand-olive rounded-full mb-4">
          <Leaf className="w-4 h-4" />
          <span className="text-sm font-medium uppercase tracking-wider">EcoFarm Project</span>
        </motion.div>
        <h1 className="serif text-5xl sm:text-6xl font-bold text-brand-olive mb-4 leading-tight">EcoFarm Survey</h1>
        <p className="text-lg text-gray-600 italic serif">Khảo sát Nông nghiệp Sinh thái & Lối sống Bền vững</p>
      </header>

      <div className="sticky top-4 z-50 mb-8 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-brand-olive/5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-brand-olive uppercase tracking-widest">Tiến độ hoàn thành</span>
          <span className="text-xs font-bold text-brand-olive">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div className="h-full bg-brand-olive" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Section title="Thông tin chung" icon={<User className="w-5 h-5" />} subtitle="Vui lòng cung cấp thông tin cơ bản của bạn">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2"><Label required>Họ và tên</Label><Input {...register('fullName')} placeholder="Nguyễn Văn A" error={errors.fullName?.message} /></div>
            <div className="space-y-2"><Label required>Email</Label><Input {...register('email')} type="email" placeholder="example@gmail.com" error={errors.email?.message} /></div>
            <div className="space-y-2"><Label>Số điện thoại</Label><Input {...register('phone')} type="tel" placeholder="090..." /></div>
            <div className="space-y-2"><Label required>Độ tuổi</Label><Select {...register('age')} error={errors.age?.message}><option value="">Chọn độ tuổi</option><option value="18-25">18-25 tuổi</option><option value="26-35">26-35 tuổi</option><option value="36-45">36-45 tuổi</option><option value="46-55">46-55 tuổi</option><option value="56-65">56-65 tuổi</option><option value="65+">Trên 65 tuổi</option></Select></div>
            <div className="sm:col-span-2 space-y-2"><Label required>Địa chỉ/Khu vực</Label><Input {...register('address')} placeholder="Tỉnh/Thành phố..." error={errors.address?.message} /></div>
            <div className="sm:col-span-2 space-y-2"><Label required>Nghề nghiệp chính</Label><Select {...register('occupation')} error={errors.occupation?.message}><option value="">Chọn nghề nghiệp</option><option value="farmer">Nông dân</option><option value="business">Doanh nhân</option><option value="office">Nhân viên văn phòng</option><option value="student">Học sinh/Sinh viên</option><option value="retired">Hưu trí</option><option value="other">Khác</option></Select></div>
          </div>
        </Section>

        <div className="bg-brand-gold-bg border-2 border-brand-gold/20 p-8 rounded-[2rem] space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-gold/10 rounded-lg"><Target className="w-6 h-6 text-brand-gold" /></div>
            <h3 className="serif text-2xl font-bold text-brand-gold">Bạn quan tâm nhất đến lĩnh vực nào?</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GroupOption id="agri" label="Nông nghiệp truyền thống" value="agriculture" icon="🌾" selected={interestedGroup === 'agriculture'} {...register('interestedGroup')} />
            <GroupOption id="bamboo" label="Tre và cây dược liệu" value="bamboo" icon="🎋" selected={interestedGroup === 'bamboo'} {...register('interestedGroup')} />
            <GroupOption id="wellness" label="Sản phẩm Wellness" value="wellness" icon="💚" selected={interestedGroup === 'wellness'} {...register('interestedGroup')} />
            <GroupOption id="gacp" label="Chứng nhận GACP" value="gacp" icon="🏆" selected={interestedGroup === 'gacp'} {...register('interestedGroup')} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {interestedGroup === 'agriculture' && (
            <motion.div key="agriculture" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Section title="Nông nghiệp" icon={<Sprout className="w-5 h-5" />} subtitle="Câu hỏi về hoạt động nông nghiệp của bạn">
                <div className="space-y-6">
                  <div className="space-y-3"><Label>Bạn có tham gia hoạt động nông nghiệp không?</Label><RadioGroup name="agricultureParticipation" options={[{ label: 'Có, là nghề chính', value: 'main' }, { label: 'Có, là nghề phụ', value: 'side' }, { label: 'Có, như sở thích', value: 'hobby' }, { label: 'Không', value: 'no' }]} register={register} /></div>
                  <div className="space-y-3"><Label>Diện tích đất nông nghiệp bạn đang sử dụng?</Label><RadioGroup name="landArea" options={[{ label: 'Dưới 1000m²', value: '<1000' }, { label: '1000-5000m²', value: '1000-5000' }, { label: '5000m²-1ha', value: '5000-10000' }, { label: '1-5ha', value: '1-5ha' }, { label: 'Trên 5ha', value: '>5ha' }, { label: 'Không có', value: 'none' }]} register={register} /></div>
                </div>
              </Section>
            </motion.div>
          )}
          {/* ... Other conditional sections ... */}
        </AnimatePresence>

        <Section title="Hoàn thành" icon={<CheckCircle2 className="w-5 h-5" />} subtitle="Một số câu hỏi tổng quát cuối cùng">
          <div className="space-y-6">
            <div className="space-y-3"><Label required>Bạn có muốn nhận thông tin về các chương trình EcoFarm không?</Label><RadioGroup name="receiveInfo" options={[{ label: 'Có, qua email', value: 'email' }, { label: 'Có, qua SMS', value: 'sms' }, { label: 'Có, qua cả hai', value: 'both' }, { label: 'Không', value: 'no' }]} register={register} /></div>
            <div className="space-y-2"><Label>Góp ý/Đề xuất khác (nếu có)</Label><Textarea {...register('feedback')} placeholder="Chia sẻ ý kiến của bạn về EcoFarm..." /></div>
          </div>
        </Section>

        <div className="pt-8">
          <button type="submit" disabled={isSubmitting} className="w-full py-6 bg-brand-olive text-white rounded-[2rem] font-bold text-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-70">
            {isSubmitting ? <><Loader2 className="w-6 h-6 animate-spin" /> Đang gửi...</> : <><Send className="w-6 h-6" /> Gửi khảo sát ngay</>}
          </button>
        </div>
      </form>

      <footer className="mt-24 text-center text-gray-400 text-sm pb-12 space-y-4">
        <div className="flex flex-col items-center gap-4">
          <button onClick={() => { setIsAdminMode(!isAdminMode); if (isAdminMode) setIsAdminAuthenticated(false); }} className="flex items-center gap-2 text-xs hover:text-brand-olive transition-colors">
            <Lock className="w-3 h-3" /> {isAdminMode ? "Ẩn công cụ quản trị" : "Quản trị viên"}
          </button>

          {isAdminMode && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-6 bg-white rounded-2xl shadow-lg border border-brand-olive/10 flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
              <h4 className="font-bold text-brand-olive text-base">Công cụ Quản trị</h4>
              {!isAdminAuthenticated ? (
                <div className="flex flex-col gap-2 w-full">
                  <input type="password" placeholder="Nhập mật khẩu hệ thống..." value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()} className="px-4 py-2 border rounded-lg text-sm outline-none focus:border-brand-olive w-full" />
                  <button onClick={handleAdminLogin} className="px-4 py-2 bg-brand-olive text-white rounded-lg text-sm font-bold w-full">Xác nhận mật khẩu</button>
                  <p className="text-[10px] text-gray-400 mt-1">Mật khẩu: ecofarm2026</p>
                </div>
              ) : !user ? (
                <div className="flex flex-col gap-3 w-full">
                  <p className="text-xs text-gray-500 text-center">Mật khẩu đúng. Bây giờ hãy đăng nhập Google với email quản trị để tải dữ liệu.</p>
                  <button onClick={handleGoogleLogin} className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all w-full">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" /> Đăng nhập Google
                  </button>
                </div>
              ) : user.email !== 'mqc.academy@gmail.com' ? (
                <div className="flex flex-col gap-3 w-full text-center">
                  <p className="text-xs text-red-500">Email {user.email} không có quyền quản trị.</p>
                  <button onClick={handleLogout} className="text-xs text-brand-olive underline">Đăng xuất và thử lại</button>
                </div>
              ) : (
                <div className="flex flex-col gap-4 w-full">
                  <div className="flex items-center gap-2 justify-center">
                    <img src={user.photoURL || ''} alt="Avatar" className="w-6 h-6 rounded-full" />
                    <span className="text-xs font-medium text-gray-600">{user.email}</span>
                  </div>
                  <button onClick={handleDownloadExcel} disabled={isDownloading} className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-all disabled:opacity-50 w-full">
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Tải toàn bộ dữ liệu (Excel)
                  </button>
                  <button onClick={handleLogout} className="text-[10px] text-gray-400 hover:text-red-500">Đăng xuất</button>
                </div>
              )}
            </motion.div>
          )}
        </div>
        <div>
          <p>© 2026 EcoFarm Survey. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// --- Sub-components (Section, Label, Input, Select, Textarea, RadioGroup, Checkbox, GroupOption) ---
// (Giữ nguyên các sub-components như cũ)
function Section({ title, icon, subtitle, children }: { title: string, icon: React.ReactNode, subtitle: string, children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-white rounded-[2rem] p-8 shadow-sm border border-brand-olive/5">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-brand-olive/10 rounded-lg text-brand-olive">{icon}</div>
        <h2 className="serif text-3xl font-bold text-brand-olive">{title}</h2>
      </div>
      <p className="text-gray-400 text-sm mb-8 italic">{subtitle}</p>
      {children}
    </motion.section>
  );
}

function Label({ children, required }: { children: React.ReactNode, required?: boolean }) {
  return <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">{children} {required && <span className="text-red-500">*</span>}</label>;
}

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { error?: string }>(({ className, error, ...props }, ref) => (
  <div className="w-full">
    <input ref={ref} className={cn("w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-brand-olive outline-none transition-all", error && "border-red-500 bg-red-50", className)} {...props} />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
));

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }>(({ className, error, children, ...props }, ref) => (
  <div className="w-full">
    <select ref={ref} className={cn("w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-brand-olive outline-none transition-all appearance-none", error && "border-red-500 bg-red-50", className)} {...props}>{children}</select>
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
));

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-brand-olive outline-none transition-all min-h-[120px] resize-none", className)} {...props} />
));

function RadioGroup({ name, options, register }: { name: string, options: { label: string, value: string }[], register: any }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border-2 border-transparent has-[:checked]:border-brand-olive has-[:checked]:bg-white">
          <input type="radio" value={opt.value} {...register(name)} className="w-4 h-4 accent-brand-olive" />
          <span className="text-sm font-medium text-gray-700">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

const Checkbox = React.forwardRef<HTMLInputElement, { label: string, value: string } & React.InputHTMLAttributes<HTMLInputElement>>(({ label, value, ...props }, ref) => (
  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border-2 border-transparent has-[:checked]:border-brand-olive has-[:checked]:bg-white">
    <input type="checkbox" value={value} ref={ref} {...props} className="w-4 h-4 accent-brand-olive rounded" />
    <span className="text-sm font-medium text-gray-700">{label}</span>
  </label>
));

const GroupOption = React.forwardRef<HTMLInputElement, { id: string, label: string, value: string, icon: string, selected: boolean } & React.InputHTMLAttributes<HTMLInputElement>>(({ id, label, value, icon, selected, ...props }, ref) => (
  <label className={cn("flex flex-col items-center justify-center p-6 bg-white/50 rounded-2xl cursor-pointer border-2 transition-all gap-3 text-center", selected ? "border-brand-gold bg-white shadow-lg scale-105" : "border-transparent hover:bg-white/80")}>
    <input type="radio" value={value} ref={ref} className="hidden" {...props} />
    <span className="text-4xl">{icon}</span>
    <span className={cn("text-sm font-bold uppercase tracking-wider", selected ? "text-brand-gold" : "text-gray-600")}>{label}</span>
  </label>
));
