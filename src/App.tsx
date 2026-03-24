import React, { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Leaf, User, Phone, Mail, MapPin, Briefcase, Target, CheckCircle2, 
  ChevronRight, Sprout, Trees, Heart, Award, Send, Loader2, 
  AlertCircle, Download, Lock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from './lib/utils';
import { 
  db, collection, addDoc, serverTimestamp, getAllSurveys,
  auth, googleProvider, signInWithPopup, signOut
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
  
  // Agriculture fields
  agricultureParticipation: z.string().optional(),
  landArea: z.string().optional(),
  organicFarming: z.string().optional(),

  // Bamboo fields
  bambooGrowing: z.string().optional(),
  herbGrowing: z.string().optional(),
  growingPurpose: z.string().optional(),

  // Wellness fields
  wellnessInterest: z.string().optional(),
  pricePremium: z.string().optional(),
  purchaseChannel: z.string().optional(),

  // GACP fields
  gacpKnowledge: z.string().optional(),
  gacpInterest: z.string().optional(),
  gacpBarrier: z.string().optional(),

  receiveInfo: z.string().min(1, 'Vui lòng chọn phương thức nhận tin'),
  feedback: z.string().optional(),
}).superRefine((data, ctx) => {
  // Bắt buộc điền thông tin mục đã chọn
  if (data.interestedGroup === 'agriculture' && !data.agricultureParticipation) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng điền thông tin này', path: ['agricultureParticipation'] });
  }
  if (data.interestedGroup === 'bamboo' && !data.bambooGrowing) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng điền thông tin này', path: ['bambooGrowing'] });
  }
  if (data.interestedGroup === 'wellness' && !data.wellnessInterest) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng điền thông tin này', path: ['wellnessInterest'] });
  }
  if (data.interestedGroup === 'gacp' && !data.gacpKnowledge) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng điền thông tin này', path: ['gacpKnowledge'] });
  }
});

type SurveyData = z.infer<typeof surveySchema>;

export default function App() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const { register, handleSubmit, control, formState: { errors } } = useForm<SurveyData>({
    resolver: zodResolver(surveySchema)
  });

  const interestedGroup = useWatch({ control, name: 'interestedGroup' });
  const allValues = useWatch({ control });

  useEffect(() => {
    const baseFields: (keyof SurveyData)[] = ['fullName', 'email', 'address', 'age', 'occupation', 'interestedGroup', 'receiveInfo'];
    const filledBase = baseFields.filter(f => !!allValues[f]).length;
    
    let extraFields: (keyof SurveyData)[] = [];
    if (interestedGroup === 'agriculture') extraFields = ['agricultureParticipation', 'landArea', 'organicFarming'];
    else if (interestedGroup === 'bamboo') extraFields = ['bambooGrowing', 'herbGrowing', 'growingPurpose'];
    else if (interestedGroup === 'wellness') extraFields = ['wellnessInterest', 'pricePremium', 'purchaseChannel'];
    else if (interestedGroup === 'gacp') extraFields = ['gacpKnowledge', 'gacpInterest', 'gacpBarrier'];

    const filledExtra = extraFields.filter(f => !!allValues[f]).length;
    const total = baseFields.length + extraFields.length;
    const filled = filledBase + filledExtra;
    setProgress(total > 0 ? (filled / total) * 100 : 0);
  }, [allValues, interestedGroup]);

  const onSubmit = async (data: SurveyData) => {
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'surveys'), { ...data, createdAt: serverTimestamp() });
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      alert('Lỗi gửi dữ liệu. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminLogin = () => {
    if (adminPassword === 'ecofarm2026') setIsAdminAuthenticated(true);
    else alert('Mật khẩu sai!');
  };

  const handleDownloadExcel = async () => {
    if (!user || user.email !== 'mqc.academy@gmail.com') {
      alert("Vui lòng đăng nhập đúng email quản trị.");
      return;
    }
    setIsDownloading(true);
    try {
      const data = await getAllSurveys();
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, `EcoFarm_Data.xlsx`);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-3xl p-12 shadow-xl text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-brand-olive mb-4">Cảm ơn bạn!</h2>
          <p className="text-gray-600 mb-8">Khảo sát của bạn đã được ghi nhận thành công.</p>
          <button onClick={() => window.location.reload()} className="w-full py-4 bg-brand-olive text-white rounded-full font-bold">Gửi khảo sát khác</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <header className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-olive/10 text-brand-olive rounded-full mb-4">
          <Leaf className="w-4 h-4" /> <span className="text-xs font-bold uppercase tracking-widest">EcoFarm Project</span>
        </div>
        <h1 className="text-5xl font-bold text-brand-olive mb-2">EcoFarm Survey</h1>
        <p className="text-gray-500 italic">Khảo sát Nông nghiệp & Lối sống Bền vững</p>
      </header>

      <div className="sticky top-4 z-50 mb-8 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-sm border border-brand-olive/10">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-brand-olive uppercase">Tiến độ hoàn thành</span>
          <span className="text-xs font-bold text-brand-olive">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div className="h-full bg-brand-olive" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Section title="Thông tin chung" icon={<User className="w-5 h-5" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2"><Label required>Họ và tên</Label><Input {...register('fullName')} error={errors.fullName?.message} /></div>
            <div className="space-y-2"><Label required>Email</Label><Input {...register('email')} type="email" error={errors.email?.message} /></div>
            <div className="space-y-2"><Label required>Độ tuổi</Label><Select {...register('age')} error={errors.age?.message}><option value="">Chọn độ tuổi</option><option value="18-35">18-35</option><option value="36-55">36-55</option><option value="55+">Trên 55</option></Select></div>
            <div className="space-y-2"><Label required>Nghề nghiệp</Label><Select {...register('occupation')} error={errors.occupation?.message}><option value="">Chọn nghề nghiệp</option><option value="office">Văn phòng</option><option value="farmer">Nông dân</option><option value="business">Kinh doanh</option><option value="other">Khác</option></Select></div>
            <div className="sm:col-span-2 space-y-2"><Label required>Địa chỉ</Label><Input {...register('address')} error={errors.address?.message} /></div>
          </div>
        </Section>

        <div className="bg-brand-gold/5 border-2 border-brand-gold/20 p-8 rounded-[2rem] space-y-6">
          <h3 className="text-2xl font-bold text-brand-gold flex items-center gap-2"><Target /> Bạn quan tâm nhất đến lĩnh vực nào?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GroupOption label="Nông nghiệp" value="agriculture" icon="🌾" selected={interestedGroup === 'agriculture'} {...register('interestedGroup')} />
            <GroupOption label="Tre & Dược liệu" value="bamboo" icon="🎋" selected={interestedGroup === 'bamboo'} {...register('interestedGroup')} />
            <GroupOption label="Sản phẩm Wellness" value="wellness" icon="💚" selected={interestedGroup === 'wellness'} {...register('interestedGroup')} />
            <GroupOption label="Chứng nhận GACP" value="gacp" icon="🏆" selected={interestedGroup === 'gacp'} {...register('interestedGroup')} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {interestedGroup === 'agriculture' && (
            <motion.div key="agri" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Section title="Mục Nông nghiệp" icon={<Sprout className="w-5 h-5" />}>
                <div className="space-y-6">
                  <div className="space-y-3"><Label required>Bạn có tham gia hoạt động nông nghiệp không?</Label><RadioGroup name="agricultureParticipation" options={[{label:'Có', value:'yes'}, {label:'Không', value:'no'}]} register={register} error={errors.agricultureParticipation?.message} /></div>
                  <div className="space-y-3"><Label>Diện tích đất canh tác?</Label><RadioGroup name="landArea" options={[{label:'Dưới 1ha', value:'<1ha'}, {label:'Trên 1ha', value:'>1ha'}]} register={register} /></div>
                </div>
              </Section>
            </motion.div>
          )}

          {interestedGroup === 'bamboo' && (
            <motion.div key="bamboo" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Section title="Mục Tre & Dược liệu" icon={<Trees className="w-5 h-5" />}>
                <div className="space-y-6">
                  <div className="space-y-3"><Label required>Bạn có đang trồng tre hoặc dược liệu không?</Label><RadioGroup name="bambooGrowing" options={[{label:'Có', value:'yes'}, {label:'Không', value:'no'}]} register={register} error={errors.bambooGrowing?.message} /></div>
                  <div className="space-y-3"><Label>Mục đích trồng chính?</Label><RadioGroup name="growingPurpose" options={[{label:'Kinh tế', value:'money'}, {label:'Môi trường', value:'nature'}]} register={register} /></div>
                </div>
              </Section>
            </motion.div>
          )}

          {interestedGroup === 'wellness' && (
            <motion.div key="wellness" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Section title="Mục Wellness" icon={<Heart className="w-5 h-5" />}>
                <div className="space-y-6">
                  <div className="space-y-3"><Label required>Bạn quan tâm đến sản phẩm chăm sóc sức khỏe nào?</Label><RadioGroup name="wellnessInterest" options={[{label:'Thực phẩm sạch', value:'food'}, {label:'Thảo dược', value:'herbs'}]} register={register} error={errors.wellnessInterest?.message} /></div>
                  <div className="space-y-3"><Label>Bạn sẵn sàng trả thêm phí cho sản phẩm hữu cơ?</Label><RadioGroup name="pricePremium" options={[{label:'Có', value:'yes'}, {label:'Không', value:'no'}]} register={register} /></div>
                </div>
              </Section>
            </motion.div>
          )}

          {interestedGroup === 'gacp' && (
            <motion.div key="gacp" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Section title="Mục GACP" icon={<Award className="w-5 h-5" />}>
                <div className="space-y-6">
                  <div className="space-y-3"><Label required>Bạn đã biết về tiêu chuẩn GACP chưa?</Label><RadioGroup name="gacpKnowledge" options={[{label:'Đã biết', value:'yes'}, {label:'Chưa biết', value:'no'}]} register={register} error={errors.gacpKnowledge?.message} /></div>
                  <div className="space-y-3"><Label>Bạn có muốn tham gia đào tạo GACP không?</Label><RadioGroup name="gacpInterest" options={[{label:'Có', value:'yes'}, {label:'Không', value:'no'}]} register={register} /></div>
                </div>
              </Section>
            </motion.div>
          )}
        </AnimatePresence>

        <Section title="Hoàn thành" icon={<CheckCircle2 className="w-5 h-5" />}>
          <div className="space-y-6">
            <div className="space-y-3"><Label required>Nhận thông tin EcoFarm?</Label><RadioGroup name="receiveInfo" options={[{label:'Có', value:'yes'}, {label:'Không', value:'no'}]} register={register} error={errors.receiveInfo?.message} /></div>
            <Textarea {...register('feedback')} placeholder="Góp ý của bạn..." />
          </div>
        </Section>

        <button type="submit" disabled={isSubmitting} className="w-full py-6 bg-brand-olive text-white rounded-[2rem] font-bold text-xl shadow-lg hover:shadow-2xl transition-all flex items-center justify-center gap-3">
          {isSubmitting ? <Loader2 className="animate-spin" /> : <Send />} Gửi khảo sát
        </button>
      </form>

      <footer className="mt-24 text-center text-gray-400 text-sm pb-12">
        <button onClick={() => setIsAdminMode(!isAdminMode)} className="flex items-center gap-2 mx-auto mb-4 hover:text-brand-olive">
          <Lock className="w-3 h-3" /> Quản trị viên
        </button>
        {isAdminMode && (
          <div className="p-6 bg-white rounded-2xl shadow-lg border border-brand-olive/10 max-w-sm mx-auto">
            {!isAdminAuthenticated ? (
              <div className="space-y-2">
                <input type="password" placeholder="Mật khẩu..." value={adminPassword} onChange={(e)=>setAdminPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none" />
                <button onClick={handleAdminLogin} className="w-full py-2 bg-brand-olive text-white rounded-lg font-bold">Xác nhận</button>
              </div>
            ) : !user ? (
              <button onClick={async () => await signInWithPopup(auth, googleProvider)} className="w-full py-2 border rounded-lg flex items-center justify-center gap-2">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" /> Đăng nhập Google
              </button>
            ) : (
              <div className="space-y-4">
                <p className="text-xs">{user.email}</p>
                <button onClick={handleDownloadExcel} disabled={isDownloading} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                  {isDownloading ? <Loader2 className="animate-spin" /> : <Download />} Tải Excel
                </button>
                <button onClick={() => signOut(auth)} className="text-xs underline">Đăng xuất</button>
              </div>
            )}
          </div>
        )}
        <p className="mt-8">© 2026 EcoFarm Survey. All rights reserved.</p>
      </footer>
    </div>
  );
}

// --- Helper Components ---
function Section({ title, icon, children }: { title: string, icon: any, children: any }) {
  return (
    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-brand-olive/5">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-brand-olive/10 rounded-lg text-brand-olive">{icon}</div>
        <h2 className="text-2xl font-bold text-brand-olive">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Label({ children, required }: { children: any, required?: boolean }) {
  return <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">{children} {required && <span className="text-red-500">*</span>}</label>;
}

const Input = React.forwardRef<HTMLInputElement, any>(({ error, ...props }, ref) => (
  <div className="w-full">
    <input ref={ref} className={cn("w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-brand-olive outline-none transition-all", error && "border-red-500")} {...props} />
    {error && <p className="text-red-500 text-[10px] mt-1">{error}</p>}
  </div>
));

const Select = React.forwardRef<HTMLSelectElement, any>(({ error, children, ...props }, ref) => (
  <div className="w-full">
    <select ref={ref} className={cn("w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-brand-olive outline-none transition-all", error && "border-red-500")} {...props}>{children}</select>
    {error && <p className="text-red-500 text-[10px] mt-1">{error}</p>}
  </div>
));

const Textarea = React.forwardRef<HTMLTextAreaElement, any>((props, ref) => (
  <textarea ref={ref} className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-brand-olive outline-none transition-all min-h-[100px]" {...props} />
));

function RadioGroup({ name, options, register, error }: any) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {options.map((opt: any) => (
        <label key={opt.value} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 border-2 border-transparent has-[:checked]:border-brand-olive has-[:checked]:bg-white">
          <input type="radio" value={opt.value} {...register(name)} className="accent-brand-olive" />
          <span className="text-sm text-gray-700">{opt.label}</span>
        </label>
      ))}
      {error && <p className="text-red-500 text-[10px]">{error}</p>}
    </div>
  );
}

const GroupOption = React.forwardRef<HTMLInputElement, any>(({ label, value, icon, selected, ...props }, ref) => (
  <label className={cn("flex flex-col items-center justify-center p-6 bg-white rounded-2xl cursor-pointer border-2 transition-all gap-2 text-center", selected ? "border-brand-gold bg-brand-gold/5 shadow-md" : "border-transparent hover:bg-gray-50")}>
    <input type="radio" value={value} ref={ref} className="hidden" {...props} />
    <span className="text-3xl">{icon}</span>
    <span className={cn("text-xs font-bold uppercase tracking-wider", selected ? "text-brand-gold" : "text-gray-600")}>{label}</span>
  </label>
));
