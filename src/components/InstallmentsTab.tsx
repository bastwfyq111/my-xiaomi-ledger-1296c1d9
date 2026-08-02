import react, {
	usememo,
	usestate
} from "react";
import {
	usestore,
	type installmentcustomcolumn
} from "@/lib/store";
import {
	fmt
} from "@/lib/format";
import * as xlsx from "xlsx";
import {
	toast
} from "sonner";
import {
	usetablecontrols
} from "@/hooks/usetablecontrols";
import {
	x,
	printer,
	alertcircle,
	search,
	arrowupdown,
	arrowup,
	arrowdown,
	edit,
	plus,
	trash,
	palette,
	settings,
	filespreadsheet,
	filetext,
	image as imageicon,
} from "lucide-react";
import tabactions from "./tabactions";
import {
	openprintdocument
} from "@/lib/printdocument";

const months_2025 = [
	"يونيو 2024",
	"يوليو 2024",
	"أغسطس 2024",
	"مارس 2025",
	"ابريل 2025",
	"مايو 2025",
	"يونيو 2025",
	"يوليو 2025",
	"أغسطس 2025",
	"سبتمبر 2025",
	"أكتوبر 2025",
	"نوفمبر2025",
	"ديسمبر2025",
];

const months_2026 = [
	"يناير",
	"فبراير",
	"مارس",
	"ابريل",
	"مايو",
	"يونيو",
	"يوليو",
	"اغسطس",
	"سبتمبر",
	"اكتوبر ",
	"نوفمبر",
	"ديسمبر",
];

// دالة تنظيف الأرقام واستخراج القيم العددية
const cleannumber = (val: any): number => {
	if (!val || isnan(number(string(val).replace(/[^0-9.-]/g, "")))) return 0;
	return number(string(val).replace(/[^0-9.-]/g, "")) || 0;
};

const escapehtml = (value: any): string =>
	string(value ?? "")
	.replace(/&/g, "&amp;")
	.replace(/</g, "&lt;")
	.replace(/>/g, "&gt;")
	.replace(/"/g, "&quot;")
	.replace(/'/g, "&#39;");

const safepdffilename = (value: any): string =>
	string(value || "متدرب")
	.replace(/[\\/:*?"<>|]/g, "-")
	.replace(/\s+/g, "_")
	.trim() || "متدرب";

// شبكة إحصائيات علوية
const statsgrid = ({
	stats,
	columns = 3
}: {
	stats: any[];columns ? : number
}) => {
	const colclass = columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3";
	return ( <
		div classname = {
			`grid ${colclass} gap-2 mb-4`
		} > {
			stats.map((stat, idx) => ( <
				div key = {
					idx
				}
				classname = {
					`${stat.bgclass} p-2 sm:p-3 rounded-lg text-center border ${stat.borderclass} shadow-sm`
				} >
				<
				div classname = "text-xs sm:text-sm font-medium text-slate-600" > {
					stat.label
				} < /div> <
				div classname = "text-sm sm:text-lg font-mono font-bold mt-1 text-slate-900 truncate" > {
					stat.value
				} <
				/div> < /
				div >
			))
		} <
		/div>
	);
};

// مكوّن النافذة المنبثقة العامة
const modal = ({
	title,
	isopen,
	onclose,
	children,
}: {
	title: string;
	isopen: boolean;
	onclose: () => void;
	children: react.reactnode;
}) => {
	if (!isopen) return null;
	return ( <
		div classname = "fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-2 sm:p-4" >
		<
		div classname = "bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
		dir = "rtl" >
		<
		div classname = "flex justify-between items-center p-4 border-b bg-gradient-to-l from-blue-50 to-slate-50 sticky top-0 z-10" >
		<
		h3 classname = "font-bold text-base sm:text-lg text-slate-900" > {
			title
		} < /h3> <
		button onclick = {
			onclose
		}
		classname = "p-1 hover:bg-slate-200 rounded-lg" >
		<
		x classname = "w-5 h-5 text-slate-600" / >
		<
		/button> < /
		div > <
		div classname = "p-4 space-y-3" > {
			children
		} < /div> < /
		div > <
		/div>
	);
};

// أيقونة الفرز للأعمدة
const sorticon = ({
	sortconfig,
	columnkey,
}: {
	sortconfig: {
		key: string;direction: "asc" | "desc"
	} | null;
	columnkey: string;
}) => {
	if (sortconfig?.key !== columnkey)
		return < arrowupdown classname = "w-3 h-3 text-slate-700 opacity-60" / > ;
	return sortconfig.direction === "asc" ? ( <
		arrowup classname = "w-3 h-3 text-emerald-700" / >
	) : ( <
		arrowdown classname = "w-3 h-3 text-emerald-700" / >
	);
};

export default function installmentstab() {
	const {
		installments,
		installments2025,
		clearinstallments,
		installmentcustomcolumns2026,
		installmentconditionalrules2026,
		setinstallmentcustomcolumns2026,
		setinstallmentconditionalrules2026,
	} = usestore() as any;

	const [paymentmodal, setpaymentmodal] = usestate < {
		row: any;month: string
	} | null > (null);
	const [payamount, setpayamount] = usestate("");
	const [newpaymentmodal, setnewpaymentmodal] = usestate(false);
	const [newstudentname, setnewstudentname] = usestate("");
	const [newstudentamount, setnewstudentamount] = usestate("");
	const [newstudentmonth, setnewstudentmonth] = usestate("");
	const [editpaymentmodal, seteditpaymentmodal] = usestate < {
		row: any;
		month: string;
		amount: number;
	} | null > (null);
	const [editamount, seteditamount] = usestate("");
	const [namesuggestions, setnamesuggestions] = usestate < string[] > ([]);
	const [showsuggestions, setshowsuggestions] = usestate(false);
	const [, sethoveredcell] = usestate < string | null > (null);
	const [importerror, setimporterror] = usestate < string | null > (null);

	const [search2025, setsearch2025] = usestate("");
	const [search2026, setsearch2026] = usestate("");

	const [sortconfig2025, setsortconfig2025] = usestate < {
		key: string;
		direction: "asc" | "desc";
	} | null > (null);
	const [sortconfig2026, setsortconfig2026] = usestate < {
		key: string;
		direction: "asc" | "desc";
	} | null > (null);

	const [editrowmodal, seteditrowmodal] = usestate < {
		year: number;
		row: any;
		index: number;
	} | null > (null);
	const [editrowdata, seteditrowdata] = usestate < any > ({});

	const extracols2026 = (installmentcustomcolumns2026 || []) as installmentcustomcolumn[];
	const [newcolmodal, setnewcolmodal] = usestate(false);
	const [newcolname, setnewcolname] = usestate("");
	const [newcoltype, setnewcoltype] = usestate < "text" | "select" | "formula" > ("text");
	const [newcoloptions, setnewcoloptions] = usestate("");
	const [newcolformula, setnewcolformula] = usestate("");

	const [editcolmodal, seteditcolmodal] = usestate < {
		oldname: string;
		name: string;
		type: "text" | "select" | "formula";
		options: string;
		formula: string;
	} | null > (null);

	const [condformatmodal, setcondformatmodal] = usestate(false);
	const [condformatparams, setcondformatparams] = usestate({
		text: "",
		color: "bg-yellow-100"
	});
	const condformatrules = (installmentconditionalrules2026 || []) as array < {
		text: string;
		color: string;
	} > ;

	const [newrowmodal2026, setnewrowmodal2026] = usestate(false);
	const [newrowdata2026, setnewrowdata2026] = usestate({
		name: "",
		batch: "",
		specialty: "",
		prevdue: 0,
		fees: 0,
	});

	const controls2026 = usetablecontrols(installments || [], [
		"name",
		"batch",
		"specialty",
		"fees",
		"prevdue",
		"totalpaid",
		"remaining",
	]);
	const controls2025 = usetablecontrols(installments2025 || [], [
		"name",
		"batch",
		"specialty",
		"fees",
		"totalpaid",
		"remaining",
	]);

	const evaluateformula = (formula: string, row: any) => {
		if (!formula) return "";
		try {
			let parsedformula = formula;
			const variables: record < string, number > = {
				fees: cleannumber(row.fees),
				prevdue: cleannumber(row.prevdue),
				totalpaid: cleannumber(row.totalpaid),
				remaining: cleannumber(row.remaining),
			};

			extracols2026.foreach((col) => {
				if (col.type !== "formula") {
					variables[col.name] = cleannumber(row.customdata?.[col.name]);
				}
			});

			object.keys(variables).foreach((key) => {
				const regex = new regexp(`\\b${key}\\b`, "g");
				parsedformula = parsedformula.replace(regex, variables[key].tostring());
			});

			const result = new function(`return ${parsedformula}`)();
			return isnan(result) ? "خطأ" : number(result).tofixed(2);
		} catch (e) {
			return "صيغة غير صالحة";
		}
	};

	const getconditionalrowclass = (row: any) => {
		const searchablevalues = [
			row.name,
			row.batch,
			row.specialty,
			row.prevdue,
			row.fees,
			row.totalpaid,
			row.remaining,
			...object.values(row.payments || {}),
			...object.values(row.customdata || {}),
		].map((val) => string(val ?? "").tolowercase());

		const matchedrule = condformatrules.find((rule) => {
			const term = rule.text.trim().tolowercase();
			return term && searchablevalues.some((value) => value.includes(term));
		});

		return matchedrule?.color || "hover:bg-slate-50/80";
	};

	const addconditionalrule = () => {
		if (!condformatparams.text.trim()) return toast.error("يرجى إدخال نص الشرط");
		setinstallmentconditionalrules2026([
			...condformatrules,
			{
				...condformatparams,
				text: condformatparams.text.trim()
			},
		]);
		setcondformatparams({
			text: "",
			color: "bg-yellow-100"
		});
		toast.success("تمت إضافة قاعدة التنسيق");
	};

	const deleteconditionalrule = (index: number) => {
		setinstallmentconditionalrules2026(condformatrules.filter((_, i) => i !== index));
	};

	const filteredrows2025 = usememo(() => {
		let result = controls2025.rows || [];
		if (search2025) {
			const term = search2025.tolowercase();
			result = result.filter(
				(r: any) =>
				(r.name && r.name.tolowercase().includes(term)) ||
				(r.batch && string(r.batch).tolowercase().includes(term)) ||
				(r.specialty && r.specialty.tolowercase().includes(term)),
			);
		}
		if (sortconfig2025) {
			result = [...result].sort((a: any, b: any) => {
				let aval = a[sortconfig2025.key];
				let bval = b[sortconfig2025.key];
				if (["fees", "totalpaid", "remaining"].includes(sortconfig2025.key)) {
					aval = cleannumber(aval);
					bval = cleannumber(bval);
				} else {
					aval = aval ? string(aval).tolowercase() : "";
					bval = bval ? string(bval).tolowercase() : "";
				}
				if (aval < bval) return sortconfig2025.direction === "asc" ? -1 : 1;
				if (aval > bval) return sortconfig2025.direction === "asc" ? 1 : -1;
				return 0;
			});
		}
		return result;
	}, [controls2025.rows, search2025, sortconfig2025]);

	const filteredrows2026 = usememo(() => {
		let result = controls2026.rows || [];
		if (search2026) {
			const term = search2026.tolowercase();
			result = result.filter(
				(r: any) =>
				(r.name && r.name.tolowercase().includes(term)) ||
				(r.batch && string(r.batch).tolowercase().includes(term)) ||
				(r.specialty && r.specialty.tolowercase().includes(term)) ||
				(r.customdata &&
					object.values(r.customdata).some((val) => string(val).tolowercase().includes(term))),
			);
		}
		if (sortconfig2026) {
			result = [...result].sort((a: any, b: any) => {
				let aval = a[sortconfig2026.key];
				let bval = b[sortconfig2026.key];
				if (["prevdue", "fees", "totalpaid", "remaining"].includes(sortconfig2026.key)) {
					aval = cleannumber(aval);
					bval = cleannumber(bval);
				} else {
					aval = aval ? string(aval).tolowercase() : "";
					bval = bval ? string(bval).tolowercase() : "";
				}
				if (aval < bval) return sortconfig2026.direction === "asc" ? -1 : 1;
				if (aval > bval) return sortconfig2026.direction === "asc" ? 1 : -1;
				return 0;
			});
		}
		return result;
	}, [controls2026.rows, search2026, sortconfig2026]);

	const handlesort2025 = (key: string) => {
		let direction: "asc" | "desc" = "asc";
		if (sortconfig2025 && sortconfig2025.key === key && sortconfig2025.direction === "asc")
			direction = "desc";
		setsortconfig2025({
			key,
			direction
		});
	};

	const handlesort2026 = (key: string) => {
		let direction: "asc" | "desc" = "asc";
		if (sortconfig2026 && sortconfig2026.key === key && sortconfig2026.direction === "asc")
			direction = "desc";
		setsortconfig2026({
			key,
			direction
		});
	};

	const totals2025 = usememo(
		() => ({
			fees: (filteredrows2025 || []).reduce((s, r) => s + cleannumber(r.fees), 0),
			paid: (filteredrows2025 || []).reduce((s, r) => s + cleannumber(r.totalpaid), 0),
			remaining: (filteredrows2025 || []).reduce((s, r) => s + cleannumber(r.remaining), 0),
			months: months_2025.reduce((acc, m) => {
					acc[m] = (filteredrows2025 || []).reduce((s, r) => s + cleannumber(r.payments?.[m]), 0);
					return acc;
				}, {}
				as record < string, number > ),
		}),
		[filteredrows2025],
	);

	const totals2026 = usememo(
		() => ({
			prevdue: (filteredrows2026 || []).reduce((s, r) => s + cleannumber(r.prevdue), 0),
			fees: (filteredrows2026 || []).reduce((s, r) => s + cleannumber(r.fees), 0),
			paid: (filteredrows2026 || []).reduce((s, r) => s + cleannumber(r.totalpaid), 0),
			remaining: (filteredrows2026 || []).reduce((s, r) => s + cleannumber(r.remaining), 0),
			months: months_2026.reduce((acc, m) => {
					acc[m] = (filteredrows2026 || []).reduce((s, r) => s + cleannumber(r.payments?.[m]), 0);
					return acc;
				}, {}
				as record < string, number > ),
		}),
		[filteredrows2026],
	);

	const allnames = usememo(() => {
		const n1 = (installments2025 || []).map((s: any) => s.name);
		const n2 = (installments || []).map((s: any) => s.name);
		return [...new set([...n1, ...n2])];
	}, [installments2025, installments]);

	const handlenamechange = (val: string) => {
		setnewstudentname(val);
		setshowsuggestions(val.length > 0);
		setnamesuggestions(
			val.length > 0 ? allnames.filter((n) => n.tolowercase().includes(val.tolowercase())) : [],
		);
	};

	const updateinstallments = (list: any[]) => usestore.setstate({
		installments: list
	});
	const updateinstallments2025 = (list: any[]) => usestore.setstate({
		installments2025: list
	});

	// تصدير ملف excel مصحح ومكتمل
	const exporttoexcel = (year: number) => {
		try {
			const monthslist = year === 2025 ? months_2025 : months_2026;
			const rows = year === 2025 ? filteredrows2025 : filteredrows2026;
			const extracols = year === 2026 ? extracols2026 : [];

			const headers =
				year === 2025 ? ["#", "اسم المتدرب", "الدفعة", "المساق", "الرسوم", ...monthslist, "المسدد", "المتبقي"] : [
					"#",
					"اسم المتدرب",
					"الدفعة",
					"المساق",
					"المتبقي من 2025",
					"الرسوم",
					...monthslist,
					...extracols.map((c) => c.name),
					"مسدد 2026",
					"الرصيد المتبقي",
					"الحالة",
				];

			const data = rows.map((row: any, i: number) => {
				if (year === 2025) {
					return [
						i + 1,
						row.name || "",
						row.batch || "",
						row.specialty || "",
						row.fees || 0,
						...monthslist.map((m) => row.payments?.[m] || 0),
						row.totalpaid || 0,
						row.remaining || 0,
					];
				} else {
					const status = row.remaining <= 0 ? "له" : "عليه";
					return [
						i + 1,
						row.name || "",
						row.batch || "",
						row.specialty || "",
						row.prevdue || 0,
						row.fees || 0,
						...monthslist.map((m) => row.payments?.[m] || 0),
						...extracols.map((col) => {
							if (col.type === "formula") return evaluateformula(col.formula || "", row);
							return row.customdata?.[col.name] || "";
						}),
						row.totalpaid || 0,
						row.remaining || 0,
						status,
					];
				}
			});

			// إضافة صف الإجماليات
			if (year === 2025) {
				data.push([
					"الإجمالي",
					"",
					"",
					"",
					totals2025.fees,
					...monthslist.map((m) => totals2025.months[m] || 0),
					totals2025.paid,
					totals2025.remaining,
				]);
			} else {
				data.push([
					"الإجمالي",
					"",
					"",
					"",
					totals2026.prevdue,
					totals2026.fees,
					...monthslist.map((m) => totals2026.months[m] || 0),
					...extracols.map(() => ""),
					totals2026.paid,
					totals2026.remaining,
					"",
				]);
			}

			const worksheet = xlsx.utils.aoa_to_sheet([headers, ...data]);
			const workbook = xlsx.utils.book_new();
			xlsx.utils.book_append_sheet(workbook, worksheet, `أقساط ${year}`);
			xlsx.writefile(workbook, `جدول_أقساط_${year}.xlsx`);
			toast.success("تم تصدير ملف excel بنجاح");
		} catch (error) {
			toast.error("حدث خطأ أثناء تصدير ملف excel");
		}
	};



	// تصدير pdf للجدول (معدل: احتواء الجدول بالكامل داخل حدود صفحة a4 أفقي بشكل موثوق)
	const exporttopdf = (year: number) => {
		try {
			const monthslist = year === 2025 ? months_2025 : months_2026;
			const rows = year === 2025 ? filteredrows2025 : filteredrows2026;
			const extracols = year === 2026 ? extracols2026 : [];
			const date = new date().tolocaledatestring("ar-sa");

			// 1. حجم خط مبدئي (سيتم ضبطه تلقائياً وبدقة عبر سكريبت القياس الفعلي بالأسفل
			//    حتى يحتوي الجدول بالكامل داخل عرض صفحة a4 مع بقاء عرض كل خلية حسب طول نصها)
			const totaldatacols =
				(year === 2025 ? 4 : 5) + monthslist.length + extracols.length + (year === 2025 ? 2 : 3);
			const fontsizepx = totaldatacols > 30 ? 8 : totaldatacols > 22 ? 9 : 10.5;
			const headerfontsizepx = fontsizepx + 0.5;
			const cellpaddingmm = totaldatacols > 30 ? 0.5 : 0.8;

			// دالة توليد صفوف البيانات
			const generatetablerows = () => {
				return rows
					.map((row: any, i: number) => {
						if (year === 2025) {
							return `
              <tr>
                <td>${i + 1}</td>
                <td class="name-cell">${row.name || ""}</td>
                <td>${row.batch || ""}</td>
                <td>${row.specialty || ""}</td>
                <td>${fmt(row.fees)}</td>
                ${monthslist
                  .map(
                    (m) =>
                      `<td>${row.payments?.[m] ? fmt(row.payments[m]) : "—"}</td>`
                  )
                  .join("")}
                <td>${fmt(row.totalpaid)}</td>
                <td>${fmt(row.remaining)}</td>
              </tr>
            `;
						} else {
							const status = row.remaining <= 0 ? "له" : "عليه";
							return `
              <tr>
                <td>${i + 1}</td>
                <td class="name-cell">${row.name || ""}</td>
                <td>${row.batch || ""}</td>
                <td>${row.specialty || ""}</td>
                <td>${fmt(row.prevdue)}</td>
                <td>${fmt(row.fees)}</td>
                ${monthslist
                  .map(
                    (m) =>
                      `<td>${row.payments?.[m] ? fmt(row.payments[m]) : "—"}</td>`
                  )
                  .join("")}
                ${extracols
                  .map((col) => {
                    if (col.type === "formula")
                      return `<td>${evaluateformula(col.formula || "", row)}</td>`;
                    return `<td>${row.customdata?.[col.name] || "—"}</td>`;
                  })
                  .join("")}
                <td>${fmt(row.totalpaid)}</td>
                <td>${fmt(row.remaining)}</td>
                <td style="background-color: ${status === "عليه" ? "#fecaca" : "#a7f3d0"};">${status}</td>
              </tr>
            `;
						}
					})
					.join("");
			};

			// دالة توليد صف الإجمالي
			const generatetotalrow = () => {
				if (year === 2025) {
					return `
            <tr class="total-row">
              <td colspan="4">الإجمالي</td>
              <td>${fmt(totals2025.fees)}</td>
              ${monthslist
                .map(
                  (m) =>
                    `<td>${totals2025.months[m] > 0 ? fmt(totals2025.months[m]) : "—"}</td>`
                )
                .join("")}
              <td>${fmt(totals2025.paid)}</td>
              <td>${fmt(totals2025.remaining)}</td>
            </tr>
          `;
				} else {
					return `
            <tr class="total-row">
              <td colspan="4">الإجمالي</td>
              <td>${fmt(totals2026.prevdue)}</td>
              <td>${fmt(totals2026.fees)}</td>
              ${monthslist
                .map(
                  (m) =>
                    `<td>${totals2026.months[m] > 0 ? fmt(totals2026.months[m]) : "—"}</td>`
                )
                .join("")}
              ${extracols.map(() => `<td>—</td>`).join("")}
              <td>${fmt(totals2026.paid)}</td>
              <td>${fmt(totals2026.remaining)}</td>
              <td></td>
            </tr>
          `;
				}
			};

			const headers =
				year === 2025 ? ["#", "الاسم", "الدفعة", "المساق", "الرسوم", ...monthslist, "المسدد", "المتبقي"] : [
					"#",
					"الاسم",
					"الدفعة",
					"المساق",
					"مدور 2025",
					"الرسوم",
					...monthslist,
					...extracols.map((c) => c.name),
					"المسدد",
					"المتبقي",
					"حالة",
				];

			const reportcss = `
        @page { size: a4 landscape; margin: 8mm 6mm; }
        html, body {
          width: 100%;
          margin: 0 !important;
          padding: 0 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        * { box-sizing: border-box; }
        .doc-header {
          text-align: center;
          margin-bottom: 4px;
          border-bottom: 1.5pt solid #b8860b;
          padding-bottom: 4px;
        }
        .doc-header h1 { font-size: 15px; font-weight: 800; margin: 0; }
        .doc-header p { margin: 2px 0 0; font-size: 9.5px; font-weight: 600; }

        /* عرض كل عمود يتحدد تلقائياً حسب طول النص بداخله (table-layout: auto) */
        .report-wrap { width: 100%; overflow: visible; }
        table {
          font-size: ${fontsizepx.tofixed(2)}px;
          table-layout: auto;
          width: auto;
          max-width: 100%;
          margin: 0 auto;
          border-collapse: collapse;
          border: 1pt solid #000;
        }
        th, td {
          padding: ${cellpaddingmm}mm 2mm !important;
          border: 0.5pt solid #000;
          // white-space: normal;
          text-align: center;
          line-height: 1;
        }
        td { font-weight: 1000; }
        th {
          background: #f5deb3 !important;
          font-size: ${headerfontsizepx.tofixed(2)}px;
          font-weight: 800;
        }
        .name-cell { text-align: center; padding-right: 1px !important; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        .total-row td {
          background: #fef3c7 !important;
          font-weight: 800;
          border-top: 1pt solid #92400e;
        }
        @media print {
          th, td { white-space: nowrap; }
          tr { page-break-inside: avoid; }
        }
      `;

			const body = `
        <div class="doc-header">
          <h1>المجلس اليمني للاختصاصات الطبية</h1>
          <p>تقرير الأقساط والمدفوعات - العام ${year}م</p>
          <p>تاريخ التقرير: ${date}</p>
        </div>
        <div class="report-wrap">
          <table id="reporttable">
            <thead>
              <tr>
                ${headers.map((h) => `<th>${escapehtml(h)}</th>`).join("")}
              </tr>
            </thead>
            <tfoot>
              ${generatetotalrow()}
            </tfoot>
            <tbody>
              ${generatetablerows()}
            </tbody>
          </table>
        </div>
        <script>
          (function () {
            // يقيس عرض الجدول الفعلي بعد أن يحسب المتصفح عرض كل عمود حسب نصه،
            // ولو تجاوز عرض الصفحة يُصغّر حجم الخط تدريجياً حتى يتسع الجدول بالكامل
            // مع الحفاظ على أن يبقى عرض كل خلية متناسباً مع طول محتواها.
            function shrinktofit() {
              var wrap = document.queryselector('.report-wrap');
              var table = document.getelementbyid('reporttable');
              if (!wrap || !table) return;
              var avail = wrap.clientwidth;
              var size = ${fontsizepx.tofixed(2)};
              var minsize = 4.2;
              var guard = 0;
              while (table.scrollwidth > avail && size > minsize && guard < 60) {
                size -= 0.15;
                table.style.fontsize = size.tofixed(2) + 'px';
                guard++;
              }
            }
            shrinktofit();
            window.addeventlistener('beforeprint', shrinktofit);
            window.addeventlistener('resize', shrinktofit);
            settimeout(shrinktofit, 300);
          })();
        <\/script>
      `;


			const ok = openprintdocument({
				title: `تقرير_الأقساط_والمدفوعات_${year}`,
				body,
				css: reportcss,
				pagesize: "a4",
				orientation: "landscape",
				margin: "8mm 6mm",
			});

			if (ok) {
				toast.success("تم فتح التقرير — اختر «حفظ كـ pdf» للحصول على ملف عالي الجودة");
			} else {
				toast.error("تم منع فتح نافذة الطباعة، يرجى السماح بالنوافذ المنبثقة");
			}
		} catch (error) {
			toast.error("فشل إنشاء التقرير");
		}
	};



	const saverowedit = (e: react.formevent) => {
		e.preventdefault();
		if (!editrowmodal) return;

		if (editrowmodal.year === 2025) {
			const list = [...(installments2025 || [])];
			const updatedrow = {
				...editrowdata,
				remaining: math.max(0, cleannumber(editrowdata.fees) - cleannumber(editrowdata.totalpaid)),
			};
			list[editrowmodal.index] = updatedrow;
			updateinstallments2025(list);
		} else {
			const list = [...(installments || [])];
			const updatedrow = {
				...editrowdata,
				remaining: math.max(
					0,
					(cleannumber(editrowdata.prevdue) + cleannumber(editrowdata.fees)) - cleannumber(editrowdata.totalpaid),
				),
			};
			list[editrowmodal.index] = updatedrow;
			updateinstallments(list);
		}

		toast.success("تم تحديث البيانات بنجاح");
		seteditrowmodal(null);
	};

	const addcustomcolumn = (e: react.formevent) => {
		e.preventdefault();
		if (!newcolname.trim()) return;
		if (extracols2026.some((c) => c.name === newcolname))
			return toast.error("اسم العمود موجود مسبقاً");

		setinstallmentcustomcolumns2026([
			...extracols2026,
			{
				name: newcolname,
				type: newcoltype,
				options: newcoltype === "select" ? newcoloptions.split(",").map((s) => s.trim()) : [],
				formula: newcoltype === "formula" ? newcolformula : "",
			},
		]);

		toast.success(`تم إضافة العمود: ${newcolname}`);
		setnewcolmodal(false);
		setnewcolname("");
		setnewcoltype("text");
		setnewcoloptions("");
		setnewcolformula("");
	};

	const savecustomcolumnedit = (e: react.formevent) => {
		e.preventdefault();
		if (!editcolmodal) return;

		if (
			editcolmodal.name !== editcolmodal.oldname &&
			extracols2026.some((c) => c.name === editcolmodal.name)
		) {
			return toast.error("اسم العمود موجود مسبقاً");
		}

		const updatedcols = extracols2026.map((c) => {
			if (c.name === editcolmodal.oldname) {
				return {
					name: editcolmodal.name,
					type: editcolmodal.type,
					options: editcolmodal.type === "select" ?
						editcolmodal.options.split(",").map((s) => s.trim()) : [],
					formula: editcolmodal.type === "formula" ? editcolmodal.formula : "",
				};
			}
			return c;
		});

		if (editcolmodal.oldname !== editcolmodal.name) {
			const list = [...(installments || [])];
			list.foreach((row) => {
				if (row.customdata && row.customdata[editcolmodal.oldname] !== undefined) {
					row.customdata[editcolmodal.name] = row.customdata[editcolmodal.oldname];
					delete row.customdata[editcolmodal.oldname];
				}
			});
			updateinstallments(list);
		}

		setinstallmentcustomcolumns2026(updatedcols);
		seteditcolmodal(null);
		toast.success("تم تعديل العمود بنجاح");
	};

	const deletecustomcolumn = (colname: string) => {
		if (!confirm(`هل أنت متأكد من حذف العمود "${colname}"؟`)) return;
		setinstallmentcustomcolumns2026(extracols2026.filter((c) => c.name !== colname));
		seteditcolmodal(null);
		toast.success("تم حذف العمود");
	};

	const recalculate2026row = (row: any) => {
		const payments = {
			...(row.payments || {})
		};
		const totalpaid = months_2026.reduce((sum, m) => sum + (number(payments[m]) || 0), 0);
		return {
			...row,
			payments,
			totalpaid,
			remaining: math.max(0, (cleannumber(row.prevdue) + cleannumber(row.fees)) - totalpaid),
		};
	};

	const update2026cellvalue = (rowindex: number, key: string, value: string) => {
		if (rowindex < 0) return;
		const list = [...(installments || [])];
		const current = {
			...list[rowindex]
		};
		const numerickeys = ["prevdue", "fees", "totalpaid", "remaining"];
		const nextvalue: any = numerickeys.includes(key) ? cleannumber(value) : value;
		list[rowindex] =
			(key === "prevdue" || key === "fees") ?
			recalculate2026row({
				...current,
				[key]: nextvalue
			}) : {
				...current,
				[key]: nextvalue
			};
		updateinstallments(list);
	};

	const update2026paymentvalue = (rowindex: number, month: string, value: string) => {
		if (rowindex < 0) return;
		const list = [...(installments || [])];
		const row = {
			...list[rowindex],
			payments: {
				...(list[rowindex]?.payments || {})
			}
		};
		row.payments[month] = cleannumber(value);
		list[rowindex] = recalculate2026row(row);
		updateinstallments(list);
	};

	const updatecustomcolvalue = (rowindex: number, colname: string, value: string) => {
		const list = [...(installments || [])];
		const row = {
			...list[rowindex],
			customdata: {
				...(list[rowindex]?.customdata || {})
			}
		};
		row.customdata[colname] = value;
		list[rowindex] = row;
		updateinstallments(list);
	};

	const deleterow2026 = (rowindex: number, name: string) => {
		if (rowindex < 0) return;
		if (!confirm(`هل أنت متأكد من حذف صف المتدرب "${name}" من جدول 2026؟`)) return;
		updateinstallments((installments || []).filter((_: any, i: number) => i !== rowindex));
		toast.success("تم حذف الصف");
	};

	const addnewrow2026 = (e: react.formevent) => {
		e.preventdefault();
		if (!newrowdata2026.name) return toast.error("يرجى إدخال اسم المتدرب");

		const payments = months_2026.reduce((acc, m) => ({
				...acc,
				[m]: 0
			}), {}
			as any);
		const newrec = {
			name: newrowdata2026.name,
			batch: newrowdata2026.batch,
			specialty: newrowdata2026.specialty,
			fees: number(newrowdata2026.fees) || 0,
			prevdue: number(newrowdata2026.prevdue) || 0,
			totalpaid: 0,
			remaining: number(newrowdata2026.prevdue) || 0,
			notes: "",
			phone: "",
			payments,
			customdata: {},
		};

		updateinstallments([...(installments || []), newrec]);
		toast.success("تم إضافة الصف بنجاح");
		setnewrowmodal2026(false);
		setnewrowdata2026({
			name: "",
			batch: "",
			specialty: "",
			prevdue: 0,
			fees: 0
		});
	};

	const addpayment = (e: react.formevent) => {
		e.preventdefault();
		if (!paymentmodal || !payamount) return toast.error("يرجى إدخال المبلغ");
		const amount = number(payamount) || 0;
		if (amount <= 0) return toast.error("مبلغ غير صحيح");
		const list = [...(installments || [])];
		const updated = list.map((s) => {
			if (s.name !== paymentmodal.row.name) return s;
			const payments = {
				...s.payments,
				[paymentmodal.month]: (number(s.payments[paymentmodal.month]) || 0) + amount,
			};
			const totalpaid = months_2026.reduce((sum, m) => sum + (number(payments[m]) || 0), 0);
			return {
				...s,
				payments,
				totalpaid,
				remaining: math.max(0, (cleannumber(s.prevdue) + cleannumber(s.fees)) - totalpaid),
			};
		});
		updateinstallments(updated);
		toast.success(`تم تسجيل دفعة ${fmt(amount)}`);
		setpaymentmodal(null);
		setpayamount("");
	};

	const addnewpayment = (e: react.formevent) => {
		e.preventdefault();
		if (!newstudentname || !newstudentamount || !newstudentmonth)
			return toast.error("يرجى إدخال جميع البيانات");
		const amount = number(newstudentamount) || 0;
		if (amount <= 0) return toast.error("مبلغ غير صحيح");
		const list = [...(installments || [])];
		const exist = list.find((s) => s.name === newstudentname);
		if (exist) {
			const updated = list.map((s) => {
				if (s.name !== newstudentname) return s;
				const payments = {
					...s.payments,
					[newstudentmonth]: (number(s.payments[newstudentmonth]) || 0) + amount,
				};
				const totalpaid = months_2026.reduce((sum, m) => sum + (number(payments[m]) || 0), 0);
				return {
					...s,
					payments,
					totalpaid,
					remaining: math.max(0, (cleannumber(s.prevdue) + cleannumber(s.fees)) - totalpaid),
				};
			});
			updateinstallments(updated);
		} else {
			const payments = months_2026.reduce(
				(acc, m) => ({
					...acc,
					[m]: m === newstudentmonth ? amount : 0
				}), {}
				as any,
			);
			const newrec = {
				name: newstudentname,
				batch: "",
				specialty: "",
				fees: 0,
				prevdue: 0,
				totalpaid: amount,
				remaining: math.max(0, 0 - amount),
				notes: "",
				phone: "",
				payments,
			};
			updateinstallments([...list, newrec]);
		}
		toast.success(`تم إضافة دفعة ${fmt(amount)}`);
		setnewpaymentmodal(false);
		setnewstudentname("");
		setnewstudentamount("");
		setnewstudentmonth("");
	};

	const editpayment = (e: react.formevent) => {
		e.preventdefault();
		if (!editpaymentmodal || !editamount) return;
		const newamount = number(editamount) || 0;
		const list = [...(installments || [])];
		const updated = list.map((s) => {
			if (s.name !== editpaymentmodal.row.name) return s;
			const payments = {
				...s.payments,
				[editpaymentmodal.month]: newamount
			};
			const totalpaid = months_2026.reduce((sum, m) => sum + (number(payments[m]) || 0), 0);
			return {
				...s,
				payments,
				totalpaid,
				remaining: math.max(0, (cleannumber(s.prevdue) + cleannumber(s.fees)) - totalpaid),
			};
		});
		updateinstallments(updated);
		toast.success("تم تعديل القسط");
		seteditpaymentmodal(null);
		seteditamount("");
	};

	const deletepayment = (row: any, month: string) => {
		if (!confirm(`حذف قسط شهر ${month}؟`)) return;
		const list = [...(installments || [])];
		const updated = list.map((s) => {
			if (s.name !== row.name) return s;
			const payments = {
				...s.payments,
				[month]: 0
			};
			const totalpaid = months_2026.reduce((sum, m) => sum + (number(payments[m]) || 0), 0);
			return {
				...s,
				payments,
				totalpaid,
				remaining: math.max(0, (cleannumber(s.prevdue) + cleannumber(s.fees)) - totalpaid),
			};
		});
		updateinstallments(updated);
		toast.success(`تم حذف قسط شهر ${month}`);
		if (editpaymentmodal) seteditpaymentmodal(null);
	};

	const importfile = (e: react.changeevent < htmlinputelement > , year: 2025 | 2026) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new filereader();
		reader.onload = (evt) => {
			try {
				const data = new uint8array(evt.target?.result as arraybuffer);
				const workbook = xlsx.read(data, {
					type: "array"
				});
				const worksheet = workbook.sheets[workbook.sheetnames[0]];
				const json = xlsx.utils.sheet_to_json(worksheet) as any[];

				const formatteddata = json.map((row: any) => {
					const monthslist = year === 2025 ? months_2025 : months_2026;
					const payments: any = {};
					let totalpaid = 0;

					monthslist.foreach((m) => {
						const cleantarget = m.trim();
						const foundkey = object.keys(row).find((k) => k.trim() === cleantarget || k === m);
						const amount = foundkey ? cleannumber(row[foundkey]) : 0;
						payments[m] = amount;
						totalpaid += amount;
					});

					const namekey = object.keys(row).find((k) => k.includes("اسم المتدرب")) || "name";
					const batchkey = object.keys(row).find((k) => k.includes("رقم الدفعة")) || "batch";
					const specialtykey = object.keys(row).find((k) => k.includes("المساق")) || "specialty";
					const feeskey = object.keys(row).find((k) => k.includes("مبلغ الرسوم")) || "fees";
					const prevduekey =
						object.keys(row).find((k) => k.includes("المتبقي عليهم من العام 2025")) || "prevdue";
					const remainingkey = object.keys(row).find((k) => k.trim() === "المتبقي") || "remaining";
					const noteskey = object.keys(row).find((k) => k.includes("ملاحظات")) || "notes";
					const phonekey = object.keys(row).find((k) => k.includes("رقم الهاتف")) || "phone";

					return {
						name: row[namekey] || "بدون اسم",
						batch: row[batchkey] || "",
						specialty: row[specialtykey] || "",
						fees: cleannumber(row[feeskey]),
						prevdue: cleannumber(row[prevduekey]),
						totalpaid: row["الإجمالي"] ? cleannumber(row["الإجمالي"]) : totalpaid,
						remaining: cleannumber(row[remainingkey]),
						notes: row[noteskey] || "",
						phone: row[phonekey] || "",
						payments,
						customdata: {},
					};
				});

				if (year === 2025) {
					usestore.setstate({
						installments2025: formatteddata
					});
				} else {
					usestore.setstate({
						installments: formatteddata
					});
				}

				toast.success(`تم استيراد بيانات العام ${year} بنجاح!`);
				setimporterror(null);
			} catch (error) {
				setimporterror("حدث خطأ في قراءة الملف.");
				toast.error("فشل استيراد الملف");
			}
		};
		reader.readasarraybuffer(file);
	};

	const getstatustext = (rem: number) =>
		rem <= 0 ? {
			text: "له",
			color: "text-emerald-800",
			bg: "bg-emerald-50"
		} : {
			text: "عليه",
			color: "text-rose-800",
			bg: "bg-rose-50"
		};

	// تم تعديل هذه الدالة لتتوافق بشكل أفضل مع صيغة حفظ pdf واللغة العربية
	const generateaccountstatement = (row: any, year: number) => {
		// 1. تحديد قائمة الأشهر بناءً على السنة المختارة
		const monthslist = year === 2025 ? months_2025 : months_2026;

		// 2. تنظيف وتحويل الرسوم والمستحقات السابقة إلى أرقام صحيحة
		const fees = cleannumber(row?.fees);
		const prevdue = cleannumber(row?.prevdue);

		// 3. حساب إجمالي المدفوعات عبر المرور على قائمة الأشهر
		const totalpaid = monthslist.reduce((sum, month) => {
			const payment = number(row?.payments?.[month]) || 0;
			return sum + payment;
		}, 0);

		// 4. حساب إجمالي المستحق:
		// إذا كانت السنة 2026 يتم إضافة المتبقي السابق إلى الرسوم الحالية، وإلا تُحسب الرسوم فقط.
		const duetotal = year === 2026 ? prevdue + 0 : fees;

		// 5. حساب المبلغ المتبقي
		const remaining = duetotal - totalpaid;

		// ✅ تمت إزالة الـ return المبكر الذي كان يقطع تنفيذ باقي الدالة
		// (كان يُرجع {fees, prevdue, totalpaid, duetotal, remaining} بدل {title, body, css})

		// استخراج اسم آمن ليستخدمه المتصفح كاسم افتراضي عند الحفظ pdf
		const safename = safepdffilename(row.name);

		const paidrows = monthslist
			.map((m) => {
				const amount = number(row.payments?.[m]) || 0;
				if (amount <= 0) return "";
				return `
          <tr>
            <td class="lbl">سداد شهر ${escapehtml(m)}</td>
            <td class="num">${escapehtml(fmt(amount))}</td>
          </tr>`;
			})
			.join("");

		const infocard = (label: string, value: string) =>
			`<div class="info-box">
        <div class="info-lbl">${escapehtml(label)}</div>
        <div class="info-val">${escapehtml(value || "—")}</div>
      </div>`;

		const prevrow =
			year === 2026 ?
			`<tr class="row-due-old">
          <td class="lbl">متبقي من العام 2025 (مدور)</td>
          <td class="num">${escapehtml(fmt(prevdue))}</td>
        </tr>` :
			"";

		const remaininglabel =
			remaining > 0 ?
			"الرصيد المتبقي (عليه)" :
			remaining < 0 ?
			"الرصيد الإضافي (له)" :
			"الحالة: تم السداد بالكامل";

		const statementcss = `
      body { padding: 4mm; font-size: 13px; }
      .header {
        background: #0f766e;
        color: #fff;
        padding: 12px;
        border-radius: 6px;
        text-align: center;
        margin-bottom: 12px;
      }
      .header h1 { font-size: 20px; font-weight: 800; color: #fff; }
      .header p { margin: 4px 0 0; font-size: 14px; font-weight: 600; color: #fff; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
      .info-box { border: 0.5pt solid #94a3b8; background: #f8fafc; padding: 8px; border-radius: 6px; text-align: center; }
      .info-lbl { font-size: 14px; font-weight: 600; color: #475569; text-align:center}
      .info-val { font-size: 14px; font-weight: 700; margin-top: 2px; }
      table { table-layout: fixed; margin-top: 4px; }
      th {
        background: #0f766e;
        color: #fff;
        padding: 7px 4px;
        font-size: 14px;
        font-weight: 700;
      }
      td { padding: 0px 0px; font-size: 16.5px; word-wrap: break-word; }
      .lbl { text-align: center; font-weight: 1000; }
      .num { font-weight: 700; font-size: 15px; font-variant-numeric: tabular-nums; }
      .row-fees td { background: #eff6ff; }
      .row-due-old td { background: #fef3c7; color: #b91c1c; }
      .row-total-due td { background: #fee2e2; font-weight: 700; }
      .row-paid td { color: #1d4ed8; }
      .row-total-paid td { background: #d1fae5; font-weight: 700; }
      .row-final td { background: #fee2e2; font-size: 16px; font-weight: 800; color: #b91c1c; border-top: 1pt solid #b91c1c; }
      .foot { margin-top: 14px; display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600; }
    `;

		const body = `
      <div class="container">
        <div class="header">
          <h1>المجلس اليمني للاختصاصات الطبية</h1>
          <p>كشف حساب متدرب - للعام ${year}م</p>
        </div>
        <div class="info-grid">
          ${infocard("اسم المتدرب", row.name)}
          ${infocard("الدفعة", row.batch)}
          ${infocard("المساق", row.specialty)}
          ${infocard("رقم الهاتف", row.phone)}
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 60%">البيان</th>
              <th style="width: 40%">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            <tr class="row-fees"><td class="lbl">إجمالي الرسوم المستحقة</td><td class="num">${escapehtml(fmt(fees))}</td></tr>
            ${prevrow}
            <tr class="row-total-due"><td class="lbl">إجمالي المبلغ المطلوب</td><td class="num">${escapehtml(fmt(duetotal))}</td></tr>
            ${paidrows}
            <tr class="row-total-paid"><td class="lbl">إجمالي المسدد (له)</td><td class="num">${escapehtml(fmt(totalpaid))}</td></tr>
            <tr class="row-final"><td class="lbl">${escapehtml(remaininglabel)}</td><td class="num">${escapehtml(fmt(math.abs(remaining)))}</td></tr>
          </tbody>
        </table>
        <div class="foot">
          <span>تاريخ الإصدار: ${escapehtml(new date().tolocaledatestring("ar-eg-u-nu-latn"))}</span>
          <span>التوقيع: ________________</span>
        </div>
      </div>
    `;

		return {
			title: `كشف_حساب_${safename}_${year}`,
			body,
			css: statementcss,
		};
	};



	// فتح كشف الحساب في نافذة طباعة عالية الجودة (يمكن حفظه كـ pdf)
	const handleexportpdf = async (row: any, year: number) => {
		const {
			title,
			body,
			css
		} = generateaccountstatement(row, year);
		const ok = openprintdocument({
			title,
			body,
			css,
			pagesize: "a4",
			orientation: "portrait",
			margin: "8mm",
		});
		if (ok) {
			toast.success("اختر «حفظ كـ pdf» من نافذة الطباعة للحصول على ملف واضح");
		} else {
			toast.error("تم منع فتح نافذة الطباعة، يرجى السماح بالنوافذ المنبثقة");
		}
	};

	// وظيفة الطباعة
	const printstatement = (row: any, year: number) => {
		void handleexportpdf(row, year);
	};


	const stats2025 = [{
			label: "إجمالي الرسوم التقديرية",
			value: fmt(totals2025.fees),
			bgclass: "bg-slate-50",
			borderclass: "border-slate-200",
		},
		{
			label: "إجمالي الأقساط المسددة",
			value: fmt(totals2025.paid),
			bgclass: "bg-emerald-50",
			borderclass: "border-emerald-200",
		},
		{
			label: "إجمالي المتبقي والأرشيف",
			value: fmt(totals2025.remaining),
			bgclass: "bg-rose-50",
			borderclass: "border-rose-200",
		},
	];

	const stats2026 = [{
			label: "المدور (متبقي 2025)",
			value: fmt(totals2026.prevdue),
			bgclass: "bg-amber-50",
			borderclass: "border-amber-200",
		},
		{
			label: "إجمالي مسدد 2026",
			value: fmt(totals2026.paid),
			bgclass: "bg-emerald-50",
			borderclass: "border-emerald-200",
		},
		{
			label: "صافي رصيد المتبقي",
			value: fmt(totals2026.remaining),
			bgclass: "bg-rose-50",
			borderclass: "border-rose-200",
		},
	];

	return ( <
		div classname = "w-full space-y-4 sm:space-y-6 p-0"
		dir = "rtl" > {
			/* ========== واجهة جدول 2025 ========== */
		} <
		div classname = "w-full bg-gradient-to-b from-teal-50 to-white shadow border border-teal-200 rounded-xl overflow-hidden" >
		<
		div classname = "bg-gradient-to-l from-teal-600 to-teal-700 px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center flex-wrap gap-2" >
		<
		div >
		<
		h2 classname = "text-sm sm:text-lg font-bold text-white" > 📊أقساط ومستندات العام 2025 <
		/h2> <
		p classname = "text-xs text-teal-100" > يشمل جميع الدفعات لعامي 2024 و 2025 < /p> < /
		div > <
		div classname = "flex gap-2 flex-wrap items-center" >
		<
		div classname = "relative" >
		<
		search classname = "w-4 h-4 absolute right-2.5 top-2 text-teal-500" / >
		<
		input type = "text"
		placeholder = "بحث (الاسم، الدفعة، المساق)..."
		value = {
			search2025
		}
		onchange = {
			(e) => setsearch2025(e.target.value)
		}
		classname = "pl-3 pr-8 py-1.5 rounded-lg text-xs border border-teal-300 outline-none focus:ring-2 focus:ring-teal-300 w-48 text-slate-800 shadow-sm" /
		>
		<
		/div>

		<
		label classname = "px-3 py-1.5 bg-white text-teal-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-teal-50 shadow" > 📥استيراد الملف {
			" "
		} <
		input type = "file"
		accept = ".xlsx,.xls"
		onchange = {
			(e) => importfile(e, 2025)
		}
		classname = "hidden" /
		>
		<
		/label>

		<
		div classname = "flex gap-1" >
		<
		button onclick = {
			() => exporttoexcel(2025)
		}
		classname = "px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold shadow hover:bg-green-200 transition-colors flex items-center gap-1" >
		<
		filespreadsheet classname = "w-3.5 h-3.5" / > excel <
		/button> <
		button onclick = {
			() => exporttopdf(2025)
		}
		classname = "px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold shadow hover:bg-red-200 transition-colors flex items-center gap-1" >
		<
		filetext classname = "w-3.5 h-3.5" / > pdf <
		/button> < /
		div >

		<
		tabactions title = "أقساط العام 2025"
		rows = {
			installments2025 || []
		}
		columns = {
			[{
					key: "name",
					label: "اسم المتدرب"
				},
				{
					key: "batch",
					label: "الدفعة"
				},
				{
					key: "specialty",
					label: "المساق"
				},
				{
					key: "fees",
					label: "الرسوم"
				},
				{
					key: "totalpaid",
					label: "المسدد"
				},
				{
					key: "remaining",
					label: "المتبقي"
				},
			]
		}
		filename = "اقساط-2025"
		numerickeys = {
			["fees", "totalpaid", "remaining"]
		}
		onclear = {
			() => clearinstallments("2025")
		}
		/> < /
		div > <
		/div>

		{
			importerror && ( <
				div classname = "bg-red-50 border-b border-red-200 p-3 flex gap-2" >
				<
				alertcircle classname = "w-5 h-5 text-red-600" / >
				<
				p classname = "text-sm text-red-700" > {
					importerror
				} < /p> < /
				div >
			)
		}

		<
		div classname = "p-3 sm:p-4" >
		<
		statsgrid stats = {
			stats2025
		}
		columns = {
			3
		}
		/> <
		div classname = "overflow-auto max-h-[65vh] rounded-lg border border-slate-200 shadow-sm relative" >
		<
		table classname = "w-full text-xs sm:text-sm" >
		<
		thead classname = "bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-600 font-bold border-b-2 border-amber-700 text-black sticky top-0 z-20 shadow-md" >
		<
		tr >
		<
		th classname = "p-2 text-center whitespace-nowrap" > # < /th> <
		th classname = "p-2 text-center whitespace-nowrap cursor-pointer hover:brightness-95"
		onclick = {
			() => handlesort2025("name")
		} >
		<
		div classname = "flex items-center justify-center gap-1" >
		اسم المتدرب < sorticon sortconfig = {
			sortconfig2025
		}
		columnkey = "name" / >
		<
		/div> < /
		th > <
		th classname = "p-2 text-center whitespace-nowrap cursor-pointer hover:brightness-95"
		onclick = {
			() => handlesort2025("batch")
		} >
		<
		div classname = "flex items-center justify-center gap-1" >
		الدفعة < sorticon sortconfig = {
			sortconfig2025
		}
		columnkey = "batch" / >
		<
		/div> < /
		th > <
		th classname = "p-2 text-center whitespace-nowrap cursor-pointer hover:brightness-95"
		onclick = {
			() => handlesort2025("specialty")
		} >
		<
		div classname = "flex items-center justify-center gap-1" >
		المساق < sorticon sortconfig = {
			sortconfig2025
		}
		columnkey = "specialty" / >
		<
		/div> < /
		th > <
		th classname = "p-2 text-center whitespace-nowrap cursor-pointer hover:brightness-95"
		onclick = {
			() => handlesort2025("fees")
		} >
		<
		div classname = "flex items-center justify-center gap-1" >
		الرسوم < sorticon sortconfig = {
			sortconfig2025
		}
		columnkey = "fees" / >
		<
		/div> < /
		th > {
			months_2025.map((m) => ( <
				th key = {
					m
				}
				classname = "p-1 text-center text-[11px] border-l border-amber-700/40 whitespace-nowrap" > {
					m
				} <
				/th>
			))
		} <
		th classname = "p-2 text-center whitespace-nowrap cursor-pointer hover:brightness-95"
		onclick = {
			() => handlesort2025("totalpaid")
		} >
		<
		div classname = "flex items-center justify-center gap-1" >
		المسدد < sorticon sortconfig = {
			sortconfig2025
		}
		columnkey = "totalpaid" / >
		<
		/div> < /
		th > <
		th classname = "p-2 text-center whitespace-nowrap cursor-pointer hover:brightness-95"
		onclick = {
			() => handlesort2025("remaining")
		} >
		<
		div classname = "flex items-center justify-center gap-1" >
		المتبقي < sorticon sortconfig = {
			sortconfig2025
		}
		columnkey = "remaining" / >
		<
		/div> < /
		th > <
		th classname = "p-2 text-center whitespace-nowrap" > إجراءات < /th> < /
		tr > <
		/thead> <
		tbody > {
			filteredrows2025.length === 0 ? ( <
				tr >
				<
				td colspan = {
					8 + months_2025.length
				}
				classname = "p-6 text-center text-slate-400" >
				لا توجد بيانات(يرجى التأكد من استيراد الملف أو تعديل البحث) <
				/td> < /
				tr >
			) : ( <
					>
					{
						filteredrows2025.map((r: any, i: number) => {
								const originalindex = (installments2025 || []).findindex(
									(orig: any) => orig.name === r.name,
								);
								return ( <
										tr key = {
											i
										}
										classname = "border-t border-slate-200 hover:bg-slate-50/80 transition-colors" >
										<
										td classname = "p-2 text-center text-black whitespace-nowrap" > {
											i + 1
										} <
										/td> <
										td classname = "p-2 text-center font-semibold text-black whitespace-nowrap text-[11px] sm:text-xs bg-teal-50/70" > {
											r.name
										} <
										/td> <
										td classname = "p-2 text-center text-black whitespace-nowrap text-[11px] sm:text-xs bg-cyan-50/70" > {
											r.batch || "—"
										} <
										/td> <
										td classname = "p-2 text-center text-black whitespace-nowrap text-[11px] sm:text-xs bg-sky-50/70" > {
											r.specialty || "—"
										} <
										/td> <
										td classname = "p-2 text-center font-mono font-semibold text-black whitespace-nowrap text-[11px] sm:text-xs bg-blue-50/70" > {
											fmt(r.fees)
										} <
										/td> {
										months_2025.map((m) => {
											const paid = number(r.payments?.[m]) || 0;
											return ( <
												td key = {
													m
												}
												classname = "p-1 text-center bg-slate-50/50 border-l border-slate-200 whitespace-nowrap" > {
													paid > 0 ? ( <
														span classname = "text-black font-bold font-mono" > {
															fmt(paid)
														} <
														/span>
													) : ( <
														span classname = "text-slate-300" > — < /span>
													)
												} <
												/td>
											);
										})
									} <
									td classname = "p-2 text-center font-mono text-black font-bold bg-emerald-50/30 whitespace-nowrap" > {
										fmt(r.totalpaid)
									} <
									/td> <
								td classname = "p-2 text-center font-mono text-black font-bold bg-rose-50/30 whitespace-nowrap" > {
										fmt(r.remaining)
									} <
									/td> <
								td classname = "p-2 text-center whitespace-nowrap flex justify-center gap-1" >
									<
									button onclick = {
										() => {
											seteditrowdata(r);
											seteditrowmodal({
												year: 2025,
												row: r,
												index: originalindex
											});
										}
									}
								classname = "p-1 bg-amber-50 text-amber-600 rounded border border-amber-200 hover:bg-amber-500 hover:text-white transition-colors"
								title = "تعديل الصف" >
									<
									edit classname = "w-3.5 h-3.5" / >
									<
									/button> <
								button onclick = {
									() => printstatement(r, 2025)
								}
								classname = "p-1 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-500 hover:text-white transition-colors"
								title = "طباعة الكشف" >
									<
									printer classname = "w-3.5 h-3.5" / >
									<
									/button> <
								button onclick = {
									() => handleexportpdf(r, 2025)
								}
								classname = "p-1 bg-emerald-50 text-emerald-600 rounded border border-emerald-200 hover:bg-emerald-500 hover:text-white transition-colors"
								title = "تنزيل pdf (متوافق مع شاومي)" >
									<
									filetext classname = "w-3.5 h-3.5" / >
									<
									/button> < /
								td > <
									/tr>
							);
						})
				} <
				tr classname = "border-t-2 border-black bg-amber-100 font-extrabold" >
				<
				td classname = "p-2 text-center text-black whitespace-nowrap"
			colspan = {
				4
			} >
			الإجماليات <
			/td> <
			td classname = "p-2 text-center font-mono text-black whitespace-nowrap" > {
				fmt(totals2025.fees)
			} <
			/td> {
			months_2025.map((m) => ( <
				td key = {
					m
				}
				classname = "p-1 text-center font-mono text-black border-l border-slate-200 whitespace-nowrap" > {
					totals2025.months[m] > 0 ? fmt(totals2025.months[m]) : "—"
				} <
				/td>
			))
		} <
		td classname = "p-2 text-center font-mono text-black whitespace-nowrap" > {
			fmt(totals2025.paid)
		} <
		/td> <
		td classname = "p-2 text-center font-mono text-black whitespace-nowrap" > {
			fmt(totals2025.remaining)
		} <
		/td> <
		td classname = "p-2 text-center whitespace-nowrap" > < /td> < /
		tr > <
		/>
	)
} <
/tbody> < /
table > <
	/div> < /
div > <
	/div>

{
	/* ========== واجهة جدول 2026 ========== */
} <
div classname = "w-full bg-gradient-to-b from-purple-50 to-white shadow border border-purple-200 rounded-xl overflow-hidden" >
	<
	div classname = "bg-gradient-to-l from-purple-600 to-purple-700 px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center flex-wrap gap-2" >
	<
	div >
	<
	h2 classname = "text-sm sm:text-lg font-bold text-white" > 📊سجل أقساط العام الحالي 2026 <
	/h2> <
p classname = "text-xs text-purple-100" > بيانات المسدد والرصيد المدور لعام 2026 < /p> < /
div > <
	div classname = "flex gap-2 flex-wrap items-center" >
	<
	button onclick = {
		() => setcondformatmodal(true)
	}
classname = {
	`px-3 py-1.5 rounded-lg text-xs font-bold shadow transition-colors flex items-center gap-1 ${
                condformatrules.length
                  ? "bg-yellow-400 text-yellow-900 animate-pulse"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`
}
title = "تلوين الصفوف حسب نص معين" >
	<
	palette classname = "w-4 h-4" / > {
		condformatrules.length ? `تنسيق نشط (${condformatrules.length})` : "تنسيق شرطي"
	} <
	/button>

	<
	div classname = "relative" >
	<
	search classname = "w-4 h-4 absolute right-2.5 top-2 text-purple-500" / >
	<
	input type = "text"
placeholder = "بحث (الاسم، الدفعة، المساق)..."
value = {
	search2026
}
onchange = {
	(e) => setsearch2026(e.target.value)
}
classname = "pl-3 pr-8 py-1.5 rounded-lg text-xs border border-purple-300 outline-none focus:ring-2 focus:ring-purple-300 w-48 text-slate-800 shadow-sm" /
	>
	<
	/div>

	<
	button onclick = {
		() => setnewrowmodal2026(true)
	}
classname = "px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold shadow hover:bg-blue-200 transition-colors flex items-center gap-1" >
	<
	plus classname = "w-3 h-3" / > طالب جديد <
	/button>

	<
	button onclick = {
		() => setnewcolmodal(true)
	}
classname = "px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold shadow hover:bg-amber-200 transition-colors flex items-center gap-1" >
	<
	plus classname = "w-3 h-3" / > عمود جديد <
	/button>

	<
	button onclick = {
		() => setnewpaymentmodal(true)
	}
classname = "px-3 py-1.5 bg-purple-100 text-purple-800 rounded-lg text-xs font-bold shadow hover:bg-purple-200 transition-colors" > ➕إضافة قسط <
	/button> <
label classname = "px-3 py-1.5 bg-white text-purple-700 rounded-lg text-xs font-bold cursor-pointer shadow hover:bg-purple-50 transition-colors" > 📥استيراد {
		" "
	} <
	input type = "file"
accept = ".xlsx,.xls"
onchange = {
	(e) => importfile(e, 2026)
}
classname = "hidden" /
	>
	<
	/label>

	<
	div classname = "flex gap-1" >
	<
	button onclick = {
		() => exporttoexcel(2026)
	}
classname = "px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold shadow hover:bg-green-200 transition-colors flex items-center gap-1" >
	<
	filespreadsheet classname = "w-3.5 h-3.5" / > excel <
	/button> <
button onclick = {
	() => exporttopdf(2026)
}
classname = "px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold shadow hover:bg-red-200 transition-colors flex items-center gap-1" >
	<
	filetext classname = "w-3.5 h-3.5" / > pdf <
	/button> < /
div >

	<
	tabactions title = "أقساط العام 2026"
rows = {
	(installments || []).map((r: any) => {
		const customvalues: any = {
			...r.customdata
		};
		extracols2026.foreach((col) => {
			if (col.type === "formula")
				customvalues[col.name] = evaluateformula(col.formula || "", r);
		});
		return {
			...r,
			...customvalues
		};
	})
}
columns = {
	[{
			key: "name",
			label: "اسم المتدرب"
		},
		{
			key: "batch",
			label: "الدفعة"
		},
		{
			key: "specialty",
			label: "المساق"
		},
		{
			key: "prevdue",
			label: "المتبقي من 2025"
		},
		{
			key: "fees",
			label: "الرسوم"
		},
		{
			key: "totalpaid",
			label: "المسدد"
		},
		{
			key: "remaining",
			label: "المتبقي"
		},
		...extracols2026.map((c) => ({
			key: c.name,
			label: c.name
		})),
	]
}
filename = "اقساط-2026"
numerickeys = {
	["prevdue", "fees", "totalpaid", "remaining"]
}
onclear = {
	() => clearinstallments()
}
/> < /
div > <
	/div>

	<
	div classname = "p-3 sm:p-4" >
	<
	statsgrid stats = {
		stats2026
	}
columns = {
	3
}
/> <
div classname = "overflow-auto max-h-[65vh] rounded-lg border border-slate-200 shadow-sm relative" >
	<
	table classname = "w-full text-xs sm:text-sm" >
	<
	thead classname = "bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-600 font-bold border-b-2 border-amber-700 text-black sticky top-0 z-20 shadow-md" >
	<
	tr >
	<
	th classname = "p-2 text-center whitespace-nowrap" > # < /th> <
th classname = "p-2 text-center whitespace-nowrap cursor-pointer hover:brightness-95"
onclick = {
		() => handlesort2026("name")
	} >
	<
	div classname = "flex items-center justify-center gap-1" >
	اسم المتدرب < sorticon sortconfig = {
		sortconfig2026
	}
columnkey = "name" / >
	<
	/div> < /
th > <
	th classname = "p-2 text-center whitespace-normal cursor-pointer hover:brightness-95"
onclick = {
		() => handlesort2026("batch")
	} >
	<
	div classname = "flex items-center justify-center gap-1" >
	دفعة < sorticon sortconfig = {
		sortconfig2026
	}
columnkey = "batch" / >
	<
	/div> < /
th > <
	th classname = "p-2 text-center whitespace-nowrap cursor-pointer hover:brightness-95"
onclick = {
		() => handlesort2026("specialty")
	} >
	<
	div classname = "flex items-center justify-center gap-1" >
	المساق < sorticon sortconfig = {
		sortconfig2026
	}
columnkey = "specialty" / >
	<
	/div> < /
th > <
	th classname = "p-2 text-center whitespace-nowrap cursor-pointer hover:brightness-95 border-x border-amber-700/40"
onclick = {
		() => handlesort2026("prevdue")
	} >
	<
	div classname = "flex items-center justify-center gap-1" >
	المتبقي من 2025 < sorticon sortconfig = {
		sortconfig2026
	}
columnkey = "prevdue" / >
	<
	/div> < /
th > <
	th classname = "p-2 text-center whitespace-nowrap cursor-pointer hover:brightness-95"
onclick = {
		() => handlesort2026("fees")
	} >
	<
	div classname = "flex items-center justify-center gap-1" >
	الرسوم < sorticon sortconfig = {
		sortconfig2026
	}
columnkey = "fees" / >
	<
	/div> < /
th > {
		months_2026.map((m) => ( <
			th key = {
				m
			}
			classname = "p-1 text-center text-xs border-l border-amber-700/40 whitespace-nowrap" > {
				m.trim()
			} <
			/th>
		))
	} {
		extracols2026.map((col) => ( <
			th key = {
				col.name
			}
			classname = "p-2 text-center text-xs border-l border-amber-700/40 whitespace-nowrap text-black" >
			<
			div classname = "flex items-center justify-center gap-1" > {
				col.name
			} <
			button onclick = {
				() =>
				seteditcolmodal({
					oldname: col.name,
					name: col.name,
					type: col.type,
					options: col.options?.join(",") || "",
					formula: col.formula || "",
				})
			}
			classname = "p-0.5 bg-black/10 hover:bg-black/20 rounded transition-all"
			title = "تعديل أو حذف العمود" >
			<
			settings classname = "w-3 h-3" / >
			<
			/button> < /
			div > <
			/th>
		))
	} <
	th classname = "p-2 text-center whitespace-nowrap cursor-pointer hover:brightness-95"
onclick = {
		() => handlesort2026("totalpaid")
	} >
	<
	div classname = "flex items-center justify-center gap-1" >
	مسدد 2026 < sorticon sortconfig = {
		sortconfig2026
	}
columnkey = "totalpaid" / >
	<
	/div> < /
th > <
	th classname = "p-2 text-center whitespace-nowrap cursor-pointer hover:brightness-95"
onclick = {
		() => handlesort2026("remaining")
	} >
	<
	div classname = "flex items-center justify-center gap-1" >
	الرصيد المتبقي < sorticon sortconfig = {
		sortconfig2026
	}
columnkey = "remaining" / >
	<
	/div> < /
th > <
	th classname = "p-2 text-center whitespace-nowrap" > حالة < /th> <
th classname = "p-2 text-center whitespace-nowrap" > إجراءات < /th> < /
tr > <
	/thead> <
tbody > {
		filteredrows2026.length === 0 ? ( <
			tr >
			<
			td colspan = {
				10 + months_2026.length + extracols2026.length
			}
			classname = "p-6 text-center text-slate-400" >
			لا توجد بيانات(يرجى التأكد من استيراد الملف أو تعديل البحث) <
			/td> < /
			tr >
		) : ( <
			>
			{
				filteredrows2026.map((r: any, i: number) => {
						const status = getstatustext(r.remaining);
						const originalindex = (installments || []).findindex(
							(orig: any) => orig.name === r.name,
						);
						const rowbgclass = getconditionalrowclass(r);

						return ( <
							tr key = {
								i
							}
							classname = {
								`border-t border-slate-200 transition-colors ${rowbgclass}`
							} >
							<
							td classname = "p-2 text-center text-black whitespace-nowrap" > {
								i + 1
							} <
							/td> <
							td classname = "p-1 text-center font-bold text-black whitespace-nowrap bg-fuchsia-50/70" >
							<
							input value = {
								r.name || ""
							}
							onchange = {
								(e) =>
								update2026cellvalue(originalindex, "name", e.target.value)
							}
							classname = "w-full min-w-32 bg-transparent text-center text-black text-[11px] sm:text-xs outline-none focus:bg-white focus:ring-1 ring-purple-300 rounded px-1 py-1" /
							>
							<
							/td> <
							td classname = "p-1 text-center text-black whitespace-nowrap bg-violet-50/70" >
							<
							input value = {
								r.batch || ""
							}
							onchange = {
								(e) =>
								update2026cellvalue(originalindex, "batch", e.target.value)
							}
							classname = "w-full min-w-20 bg-transparent text-center text-black text-[11px] sm:text-xs outline-none focus:bg-white focus:ring-1 ring-purple-300 rounded px-1 py-1"
							placeholder = "—" /
							>
							<
							/td> <
							td classname = "p-1 text-center text-black whitespace-nowrap bg-purple-50/70" >
							<
							input value = {
								r.specialty || ""
							}
							onchange = {
								(e) =>
								update2026cellvalue(originalindex, "specialty", e.target.value)
							}
							classname = "w-full min-w-24 bg-transparent text-center text-black text-[11px] sm:text-xs outline-none focus:bg-white focus:ring-1 ring-purple-300 rounded px-1 py-1"
							placeholder = "—" /
							>
							<
							/td> <
							td classname = "p-1 text-center font-mono text-black font-bold bg-amber-50/20 whitespace-nowrap" >
							<
							input type = "number"
							value = {
								r.prevdue || 0
							}
							onchange = {
								(e) =>
								update2026cellvalue(originalindex, "prevdue", e.target.value)
							}
							classname = "w-full min-w-20 bg-transparent text-center text-black text-[11px] sm:text-xs outline-none focus:bg-white focus:ring-1 ring-purple-300 rounded px-1 py-1" /
							>
							<
							/td> <
							td classname = "p-1 text-center font-mono text-black font-bold whitespace-nowrap bg-indigo-50/70" >
							<
							input type = "number"
							value = {
								r.fees || 0
							}
							onchange = {
								(e) =>
								update2026cellvalue(originalindex, "fees", e.target.value)
							}
							classname = "w-full min-w-20 bg-transparent text-center text-black text-[11px] sm:text-xs outline-none focus:bg-white focus:ring-1 ring-purple-300 rounded px-1 py-1" /
							>
							<
							/td> {
							months_2026.map((m) => {
								const paid = number(r.payments?.[m]) || 0;
								const cellid = `${r.name}-${m}`;
								return ( <
									td key = {
										m
									}
									classname = "p-1 text-center relative bg-white/40 border-l border-slate-200 hover:bg-slate-100 cursor-pointer group transition-colors whitespace-nowrap"
									onmouseenter = {
										() => sethoveredcell(cellid)
									}
									onmouseleave = {
										() => sethoveredcell(null)
									} >
									<
									input type = "number"
									value = {
										paid || ""
									}
									onchange = {
										(e) =>
										update2026paymentvalue(originalindex, m, e.target.value)
									}
									classname = "w-20 bg-transparent text-center font-mono text-black font-bold outline-none focus:bg-white focus:ring-1 ring-emerald-300 rounded px-1 py-1"
									placeholder = "—"
									min = "0"
									step = "0.01" /
									>
									<
									/td>
								);
							})
						}

						{
							extracols2026.map((col) => ( <
									td key = {
										col.name
									}
									classname = "p-1 border-l border-slate-200" > {
										col.type === "select" ? ( <
											select classname = "w-full text-center text-black bg-transparent outline-none focus:bg-white focus:ring-1 ring-blue-300 rounded px-1 py-1 text-xs"
											value = {
												r.customdata?.[col.name] || ""
											}
											onchange = {
												(e) =>
												updatecustomcolvalue(originalindex, col.name, e.target.value)
											} >
											<
											option value = "" > -اختر - < /option> {
											col.options?.map((opt, idx) => ( <
												option key = {
													idx
												}
												value = {
													opt
												} > {
													opt
												} <
												/option>
											))
										} <
										/select>
									): col.type === "formula" ? ( <
										div classname = "text-center font-mono text-xs font-bold text-black bg-white/50 py-1.5 rounded" > {
											evaluateformula(col.formula || "", r)
										} <
										/div>
									) : ( <
										input type = "text"
										classname = "w-full text-center text-black bg-transparent outline-none focus:bg-white focus:ring-1 ring-blue-300 rounded px-1 py-1 text-xs"
										value = {
											r.customdata?.[col.name] || ""
										}
										onchange = {
											(e) =>
											updatecustomcolvalue(originalindex, col.name, e.target.value)
										}
										placeholder = "—" /
										>
									)
								} <
								/td>
							))
					}

					<
					td classname = "p-2 text-center font-mono text-black font-bold bg-emerald-50/30 whitespace-nowrap" > {
						fmt(r.totalpaid)
					} <
					/td> <
					td classname = "p-2 text-center font-mono text-black font-bold bg-rose-50/30 whitespace-nowrap" > {
						fmt(r.remaining)
					} <
					/td> <
					td classname = "p-2 text-center whitespace-nowrap" >
					<
					span classname = {
						`px-1.5 py-0.5 rounded-full text-xs font-bold ${status.bg} ${status.color}`
					} > {
						status.text
					} <
					/span> < /
					td > <
					td classname = "p-2 text-center whitespace-nowrap flex justify-center gap-1" >
					<
					button onclick = {
						() => {
							seteditrowdata(r);
							seteditrowmodal({
								year: 2026,
								row: r,
								index: originalindex
							});
						}
					}
					classname = "p-1 bg-amber-50 text-amber-600 rounded border border-amber-200 hover:bg-amber-500 hover:text-white transition-colors"
					title = "تعديل الصف" >
					<
					edit classname = "w-3.5 h-3.5" / >
					<
					/button> <
					button onclick = {
						() => printstatement(r, 2026)
					}
					classname = "p-1 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-500 hover:text-white transition-colors"
					title = "طباعة الكشف" >
					<
					printer classname = "w-3.5 h-3.5" / >
					<
					/button> <
					button onclick = {
						() => handleexportpdf(r, 2026)
					}
					classname = "p-1 bg-emerald-50 text-emerald-600 rounded border border-emerald-200 hover:bg-emerald-500 hover:text-white transition-colors"
					title = "تنزيل pdf (متوافق مع شاومي)" >
					<
					filetext classname = "w-3.5 h-3.5" / >
					<
					/button> <
					button onclick = {
						() => deleterow2026(originalindex, r.name)
					}
					classname = "p-1 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-500 hover:text-white transition-colors"
					title = "حذف الصف" >
					<
					trash classname = "w-3.5 h-3.5" / >
					<
					/button> < /
					td > <
					/tr>
				);
			})
	} <
	tr classname = "border-t-2 border-black bg-amber-100 font-extrabold" >
	<
	td classname = "p-2 text-center text-black whitespace-nowrap"
colspan = {
		4
	} >
	الإجماليات <
	/td> <
td classname = "p-2 text-center font-mono text-black whitespace-nowrap" > {
		fmt(totals2026.prevdue)
	} <
	/td> <
td classname = "p-2 text-center font-mono text-black whitespace-nowrap" > {
		fmt(totals2026.fees)
	} <
	/td>

{
	months_2026.map((m) => ( <
		td key = {
			m
		}
		classname = "p-1 text-center font-mono text-black border-l border-slate-200 whitespace-nowrap" > {
			totals2026.months[m] > 0 ? fmt(totals2026.months[m]) : "—"
		} <
		/td>
	))
} {
	extracols2026.map((col) => ( <
		td key = {
			col.name
		}
		classname = "p-1 text-center text-black border-l border-slate-200 whitespace-nowrap" > —
		<
		/td>
	))
} <
td classname = "p-2 text-center font-mono text-black whitespace-nowrap" > {
		fmt(totals2026.paid)
	} <
	/td> <
td classname = "p-2 text-center font-mono text-black whitespace-nowrap" > {
		fmt(totals2026.remaining)
	} <
	/td> <
td classname = "p-2 text-center whitespace-nowrap" > < /td> <
td classname = "p-2 text-center whitespace-nowrap" > < /td> < /
tr > <
	/>
)
} <
/tbody> < /
table > <
	/div> < /
div > <
	/div>

{
	/* ========== النوافذ المنبثقة ========== */
}

<
modal title = "🎨 التنسيق الشرطي للصفوف"
isopen = {
	condformatmodal
}
onclose = {
		() => setcondformatmodal(false)
	} >
	<
	div classname = "space-y-4" >
	<
	p classname = "text-xs text-slate-500" >
	سيتم تلوين الصف بالكامل إذا كان يحتوي على النص الذي تدخله أدناه في أي عمود. <
	/p>

	<
	div >
	<
	label classname = "block text-xs font-semibold text-slate-700 mb-1" >
	النص المطلوب البحث عنه(الشرط) <
	/label> <
input type = "text"
value = {
	condformatparams.text
}
onchange = {
	(e) => setcondformatparams({
		...condformatparams,
		text: e.target.value
	})
}
classname = "w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-300 outline-none"
placeholder = "مثال: معتمد, منسحب, مجاني..." /
	>
	<
	/div>

	<
	div >
	<
	label classname = "block text-xs font-semibold text-slate-700 mb-2" >
	اختر لون تمييز الصف <
	/label> <
div classname = "flex gap-2" > {
		[{
				name: "أصفر",
				class: "bg-yellow-100 hover:bg-yellow-100"
			},
			{
				name: "أخضر",
				class: "bg-green-100 hover:bg-green-100"
			},
			{
				name: "أحمر",
				class: "bg-red-100 hover:bg-red-100"
			},
			{
				name: "أزرق",
				class: "bg-blue-100 hover:bg-blue-100"
			},
			{
				name: "بنفسجي",
				class: "bg-purple-100 hover:bg-purple-100"
			},
		].map((color) => ( <
			button key = {
				color.class
			}
			onclick = {
				() => setcondformatparams({
					...condformatparams,
					color: color.class
				})
			}
			classname = {
				`w-8 h-8 rounded-full border-2 ${
                    condformatparams.color === color.class
                      ? "border-slate-800 scale-110"
                      : "border-transparent"
                  } ${color.class}`
			}
			title = {
				color.name
			}
			/>
		))
	} <
	/div> < /
div >

	{
		condformatrules.length > 0 && ( <
			div classname = "space-y-2 border-t pt-3" >
			<
			div classname = "text-xs font-bold text-slate-700" > القواعد الحالية < /div> {
			condformatrules.map((rule, idx) => ( <
				div key = {
					`${rule.text}-${idx}`
				}
				classname = "flex items-center justify-between gap-2 bg-slate-50 border rounded-lg p-2" >
				<
				span classname = {
					`px-2 py-1 rounded text-xs ${rule.color}`
				} > {
					rule.text
				} < /span> <
				button onclick = {
					() => deleteconditionalrule(idx)
				}
				classname = "text-red-600 hover:text-red-800 text-xs font-bold" >
				حذف <
				/button> < /
				div >
			))
		} <
		/div>
	)
}

<
div classname = "flex justify-between items-center pt-3 border-t mt-4" >
	<
	button onclick = {
		() => {
			setcondformatparams({
				text: "",
				color: "bg-yellow-100"
			});
			setinstallmentconditionalrules2026([]);
			setcondformatmodal(false);
		}
	}
classname = "px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100" >
	إلغاء التنسيق تماماً <
	/button> <
div classname = "flex gap-2" >
	<
	button onclick = {
		addconditionalrule
	}
classname = "px-4 py-2 bg-amber-500 text-white rounded-lg font-bold" >
	إضافة قاعدة <
	/button> <
button onclick = {
	() => setcondformatmodal(false)
}
classname = "px-4 py-2 bg-purple-600 text-white rounded-lg font-bold" >
	إغلاق <
	/button> < /
div > <
	/div> < /
div > <
	/modal>

	<
	modal title = {
		`⚙️ تعديل العمود: ${editcolmodal?.oldname}`
	}
isopen = {
	!!editcolmodal
}
onclose = {
		() => seteditcolmodal(null)
	} > {
		editcolmodal && ( <
			form onsubmit = {
				savecustomcolumnedit
			}
			classname = "space-y-3" >
			<
			div >
			<
			label classname = "block text-xs font-semibold text-slate-700 mb-1" > اسم العمود < /label> <
			input type = "text"
			required value = {
				editcolmodal.name
			}
			onchange = {
				(e) => seteditcolmodal({
					...editcolmodal,
					name: e.target.value
				})
			}
			classname = "w-full p-2 border rounded-lg" /
			>
			<
			/div>

			<
			div >
			<
			label classname = "block text-xs font-semibold text-slate-700 mb-1" > نوع العمود < /label> <
			select value = {
				editcolmodal.type
			}
			onchange = {
				(e: any) => seteditcolmodal({
					...editcolmodal,
					type: e.target.value
				})
			}
			classname = "w-full p-2 border rounded-lg" >
			<
			option value = "text" > نص أو رقم حر(إدخال يدوي) < /option> <
			option value = "select" > قائمة منسدلة(خيارات محددة) < /option> <
			option value = "formula" > معادلة رياضية دالة(حساب تلقائي) < /option> < /
			select > <
			/div>

			{
				editcolmodal.type === "select" && ( <
					div >
					<
					label classname = "block text-xs font-semibold text-slate-700 mb-1" >
					الخيارات(افصل بينها بفاصلة) <
					/label> <
					input type = "text"
					required value = {
						editcolmodal.options
					}
					onchange = {
						(e) => seteditcolmodal({
							...editcolmodal,
							options: e.target.value
						})
					}
					classname = "w-full p-2 border rounded-lg"
					placeholder = "مثال: معتمد, غير معتمد" /
					>
					<
					/div>
				)
			}

			{
				editcolmodal.type === "formula" && ( <
					div >
					<
					label classname = "block text-xs font-semibold text-slate-700 mb-1" >
					المعادلة(استخدم المتغيرات الإنجليزية) <
					/label> <
					input type = "text"
					required value = {
						editcolmodal.formula
					}
					onchange = {
						(e) => seteditcolmodal({
							...editcolmodal,
							formula: e.target.value
						})
					}
					classname = "w-full p-2 border rounded-lg text-left"
					dir = "ltr" /
					>
					<
					/div>
				)
			}

			<
			div classname = "flex justify-between items-center pt-3 border-t mt-4" >
			<
			button type = "button"
			onclick = {
				() => deletecustomcolumn(editcolmodal.oldname)
			}
			classname = "px-4 py-2 bg-red-100 text-red-700 rounded-lg flex items-center gap-1 font-bold" >
			<
			trash classname = "w-4 h-4" / > حذف العمود <
			/button> <
			div classname = "flex gap-2" >
			<
			button type = "button"
			onclick = {
				() => seteditcolmodal(null)
			}
			classname = "px-4 py-2 bg-slate-100 text-slate-700 rounded-lg" >
			إلغاء <
			/button> <
			button type = "submit"
			classname = "px-4 py-2 bg-blue-600 text-white rounded-lg font-bold" >
			حفظ التعديل <
			/button> < /
			div > <
			/div> < /
			form >
		)
	} <
	/modal>

	<
	modal title = {
		`✏️ تعديل بيانات المتدرب (${editrowmodal?.year})`
	}
isopen = {
	!!editrowmodal
}
onclose = {
		() => seteditrowmodal(null)
	} >
	<
	form onsubmit = {
		saverowedit
	}
classname = "space-y-3" >
	<
	div >
	<
	label classname = "block text-xs font-semibold text-slate-700 mb-1" > اسم المتدرب < /label> <
input type = "text"
required value = {
	editrowdata?.name || ""
}
onchange = {
	(e) => seteditrowdata({
		...editrowdata,
		name: e.target.value
	})
}
classname = "w-full p-2 border rounded-lg" /
	>
	<
	/div> <
div classname = "grid grid-cols-2 gap-2" >
	<
	div >
	<
	label classname = "block text-xs font-semibold text-slate-700 mb-1" > الدفعة < /label> <
input type = "text"
value = {
	editrowdata?.batch || ""
}
onchange = {
	(e) => seteditrowdata({
		...editrowdata,
		batch: e.target.value
	})
}
classname = "w-full p-2 border rounded-lg" /
	>
	<
	/div> <
div >
	<
	label classname = "block text-xs font-semibold text-slate-700 mb-1" > المساق < /label> <
input type = "text"
value = {
	editrowdata?.specialty || ""
}
onchange = {
	(e) => seteditrowdata({
		...editrowdata,
		specialty: e.target.value
	})
}
classname = "w-full p-2 border rounded-lg" /
	>
	<
	/div> < /
div > {
		editrowmodal?.year === 2025 && ( <
			div >
			<
			label classname = "block text-xs font-semibold text-slate-700 mb-1" >
			الرسوم الكلية <
			/label> <
			input type = "number"
			value = {
				editrowdata?.fees || 0
			}
			onchange = {
				(e) => seteditrowdata({
					...editrowdata,
					fees: e.target.value
				})
			}
			classname = "w-full p-2 border rounded-lg" /
			>
			<
			/div>
		)
	} {
		editrowmodal?.year === 2026 && ( <
			div >
			<
			label classname = "block text-xs font-semibold text-slate-700 mb-1" >
			المتبقي من 2025(المدور) <
			/label> <
			input type = "number"
			value = {
				editrowdata?.prevdue || 0
			}
			onchange = {
				(e) => seteditrowdata({
					...editrowdata,
					prevdue: e.target.value
				})
			}
			classname = "w-full p-2 border rounded-lg" /
			>
			<
			/div>
		)
	} <
	div classname = "flex justify-end gap-2 pt-3 border-t mt-4" >
	<
	button type = "button"
onclick = {
	() => seteditrowmodal(null)
}
classname = "px-4 py-2 bg-slate-100 text-slate-700 rounded-lg" >
	إلغاء <
	/button> <
button type = "submit"
classname = "px-4 py-2 bg-amber-600 text-white rounded-lg font-bold" >
	حفظ التعديلات <
	/button> < /
div > <
	/form> < /
modal >

	<
	modal title = "➕ إضافة عمود جديد (2026)"
isopen = {
	newcolmodal
}
onclose = {
		() => setnewcolmodal(false)
	} >
	<
	form onsubmit = {
		addcustomcolumn
	}
classname = "space-y-3" >
	<
	div >
	<
	label classname = "block text-xs font-semibold text-slate-700 mb-1" > اسم العمود < /label> <
input type = "text"
required value = {
	newcolname
}
onchange = {
	(e) => setnewcolname(e.target.value)
}
classname = "w-full p-2 border rounded-lg"
autofocus placeholder = "مثل: حالة الاعتماد، الخصم..." /
	>
	<
	/div>

	<
	div >
	<
	label classname = "block text-xs font-semibold text-slate-700 mb-1" > نوع العمود < /label> <
select value = {
	newcoltype
}
onchange = {
	(e: any) => setnewcoltype(e.target.value)
}
classname = "w-full p-2 border rounded-lg" >
	<
	option value = "text" > نص أو رقم حر(إدخال يدوي) < /option> <
option value = "select" > قائمة منسدلة(خيارات محددة) < /option> <
option value = "formula" > معادلة رياضية دالة(حساب تلقائي) < /option> < /
select > <
	/div>

{
	newcoltype === "select" && ( <
		div >
		<
		label classname = "block text-xs font-semibold text-slate-700 mb-1" >
		الخيارات(افصل بينها بفاصلة) <
		/label> <
		input type = "text"
		required value = {
			newcoloptions
		}
		onchange = {
			(e) => setnewcoloptions(e.target.value)
		}
		classname = "w-full p-2 border rounded-lg"
		placeholder = "مثال: معتمد, غير معتمد, قيد المراجعة" /
		>
		<
		/div>
	)
}

{
	newcoltype === "formula" && ( <
		div >
		<
		label classname = "block text-xs font-semibold text-slate-700 mb-1" >
		المعادلة(استخدم المتغيرات الإنجليزية) <
		/label> <
		input type = "text"
		required value = {
			newcolformula
		}
		onchange = {
			(e) => setnewcolformula(e.target.value)
		}
		classname = "w-full p-2 border rounded-lg text-left"
		dir = "ltr"
		placeholder = "مثال: fees - totalpaid" /
		>
		<
		/div>
	)
}

<
div classname = "flex justify-end gap-2 pt-3 border-t mt-4" >
	<
	button type = "button"
onclick = {
	() => setnewcolmodal(false)
}
classname = "px-4 py-2 bg-slate-100 text-slate-700 rounded-lg" >
	إلغاء <
	/button> <
button type = "submit"
classname = "px-4 py-2 bg-amber-600 text-white rounded-lg font-bold" >
	إضافة العمود <
	/button> < /
div > <
	/form> < /
modal >

	<
	modal title = "➕ إضافة طالب جديد لعام 2026"
isopen = {
	newrowmodal2026
}
onclose = {
		() => setnewrowmodal2026(false)
	} >
	<
	form onsubmit = {
		addnewrow2026
	}
classname = "space-y-3" >
	<
	div >
	<
	label classname = "block text-xs font-semibold text-slate-700 mb-1" > اسم المتدرب * < /label> <
input type = "text"
required value = {
	newrowdata2026.name
}
onchange = {
	(e) => setnewrowdata2026({
		...newrowdata2026,
		name: e.target.value
	})
}
classname = "w-full p-2 border rounded-lg" /
	>
	<
	/div> <
div classname = "grid grid-cols-2 gap-2" >
	<
	div >
	<
	label classname = "block text-xs font-semibold text-slate-700 mb-1" > الدفعة < /label> <
input type = "text"
value = {
	newrowdata2026.batch
}
onchange = {
	(e) => setnewrowdata2026({
		...newrowdata2026,
		batch: e.target.value
	})
}
classname = "w-full p-2 border rounded-lg" /
	>
	<
	/div> <
div >
	<
	label classname = "block text-xs font-semibold text-slate-700 mb-1" > المساق < /label> <
input type = "text"
value = {
	newrowdata2026.specialty
}
onchange = {
	(e) =>
	setnewrowdata2026({
		...newrowdata2026,
		specialty: e.target.value
	})
}
classname = "w-full p-2 border rounded-lg" /
	>
	<
	/div> < /
div > <
	div classname = "grid grid-cols-2 gap-2" >
	<
	div >
	<
	label classname = "block text-xs font-semibold text-slate-700 mb-1" >
	الرسوم الكلية <
	/label> <
input type = "number"
value = {
	newrowdata2026.fees
}
onchange = {
	(e) =>
	setnewrowdata2026({
		...newrowdata2026,
		fees: number(e.target.value)
	})
}
classname = "w-full p-2 border rounded-lg" /
	>
	<
	/div> <
div >
	<
	label classname = "block text-xs font-semibold text-slate-700 mb-1" >
	المتبقي من 2025 <
	/label> <
input type = "number"
value = {
	newrowdata2026.prevdue
}
onchange = {
	(e) =>
	setnewrowdata2026({
		...newrowdata2026,
		prevdue: number(e.target.value)
	})
}
classname = "w-full p-2 border rounded-lg" /
	>
	<
	/div> < /
div > <
	div classname = "flex justify-end gap-2 pt-3 border-t mt-4" >
	<
	button type = "button"
onclick = {
	() => setnewrowmodal2026(false)
}
classname = "px-4 py-2 bg-slate-100 text-slate-700 rounded-lg" >
	إلغاء <
	/button> <
button type = "submit"
classname = "px-4 py-2 bg-blue-600 text-white rounded-lg font-bold" >
	إضافة المتدرب <
	/button> < /
div > <
	/form> < /
modal >

	<
	modal title = "➕ إضافة قسط جديد - 2026"
isopen = {
	newpaymentmodal
}
onclose = {
		() => setnewpaymentmodal(false)
	} >
	<
	form onsubmit = {
		addnewpayment
	}
classname = "space-y-3" >
	<
	div classname = "relative" >
	<
	label classname = "block text-xs font-semibold text-slate-700 mb-1" > اسم المتدرب * < /label> <
input type = "text"
required placeholder = "ابحث عن الاسم"
value = {
	newstudentname
}
onchange = {
	(e) => handlenamechange(e.target.value)
}
onfocus = {
	() => newstudentname.length > 0 && setshowsuggestions(true)
}
classname = "w-full p-2 border rounded-lg outline-none" /
	>
	{
		showsuggestions && namesuggestions.length > 0 && ( <
			div classname = "absolute top-full right-0 left-0 bg-white border rounded-b-lg shadow-xl z-50 max-h-32 overflow-y-auto" > {
				namesuggestions.map((n, idx) => ( <
					div key = {
						idx
					}
					onclick = {
						() => {
							setnewstudentname(n);
							setshowsuggestions(false);
						}
					}
					classname = "p-2 text-sm hover:bg-purple-50 cursor-pointer text-slate-800" > {
						n
					} <
					/div>
				))
			} <
			/div>
		)
	} <
	/div> <
div >
	<
	label classname = "block text-xs font-semibold text-slate-700 mb-1" >
	المبلغ المالي *
	<
	/label> <
input type = "number"
required value = {
	newstudentamount
}
onchange = {
	(e) => setnewstudentamount(e.target.value)
}
classname = "w-full p-2 border rounded-lg"
min = "0"
step = "0.01" /
	>
	<
	/div> <
div >
	<
	label classname = "block text-xs font-semibold text-slate-700 mb-1" >
	الشهر المستهدف *
	<
	/label> <
select required value = {
	newstudentmonth
}
onchange = {
	(e) => setnewstudentmonth(e.target.value)
}
classname = "w-full p-2 border rounded-lg" >
	<
	option value = "" > --اختر الشهر-- < /option> {
months_2026.map((m) => ( <
	option key = {
		m
	}
	value = {
		m
	} > {
		m.trim()
	} <
	/option>
))
} <
/select> < /
div > <
	div classname = "flex justify-end gap-2 pt-3 border-t mt-4" >
	<
	button type = "button"
onclick = {
	() => setnewpaymentmodal(false)
}
classname = "px-4 py-2 bg-slate-100 text-slate-700 rounded-lg" >
	إلغاء <
	/button> <
button type = "submit"
classname = "px-4 py-2 bg-purple-600 text-white rounded-lg font-bold" >
	حفظ <
	/button> < /
div > <
	/form> < /
modal >

	<
	modal title = "💵 تسجيل دفعة مالية"
isopen = {
	!!paymentmodal
}
onclose = {
		() => setpaymentmodal(null)
	} > {
		paymentmodal && ( <
			>
			<
			div classname = "bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-slate-800" >
			<
			p >
			<
			b > المتدرب: < /b> {paymentmodal.row.name} < /
			p > <
			p >
			<
			b > شهر: < /b> {paymentmodal.month} < /
			p > <
			/div> <
			form onsubmit = {
				addpayment
			}
			classname = "space-y-3 mt-3" >
			<
			div >
			<
			label classname = "block text-xs font-semibold text-slate-700 mb-1" >
			المبلغ المدفوع *
			<
			/label> <
			input type = "number"
			required value = {
				payamount
			}
			onchange = {
				(e) => setpayamount(e.target.value)
			}
			classname = "w-full p-2 border rounded-lg"
			autofocus min = "0"
			step = "0.01" /
			>
			<
			/div> <
			div classname = "flex justify-end gap-2 pt-3 border-t mt-4" >
			<
			button type = "button"
			onclick = {
				() => setpaymentmodal(null)
			}
			classname = "px-4 py-2 bg-slate-100 text-slate-700 rounded-lg" >
			إلغاء <
			/button> <
			button type = "submit"
			classname = "px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold" >
			تأكيد التوريد <
			/button> < /
			div > <
			/form> < / >
		)
	} <
	/modal>

	<
	modal title = "✏️ مراجعة وتعديل القسط"
isopen = {
	!!editpaymentmodal
}
onclose = {
		() => seteditpaymentmodal(null)
	} > {
		editpaymentmodal && ( <
			>
			<
			div classname = "bg-blue-50 border border-blue-200 rounded-lg p-3 text-slate-800" >
			<
			p classname = "font-bold" > {
				editpaymentmodal.row.name
			} < /p> <
			p > بيان شهر: {
				editpaymentmodal.month
			} < /p> < /
			div > <
			form onsubmit = {
				editpayment
			}
			classname = "space-y-3 mt-3" >
			<
			div >
			<
			label classname = "block text-xs font-semibold text-slate-700 mb-1" >
			المبلغ المعدل *
			<
			/label> <
			input type = "number"
			required value = {
				editamount
			}
			onchange = {
				(e) => seteditamount(e.target.value)
			}
			classname = "w-full p-2 border rounded-lg"
			min = "0"
			step = "0.01" /
			>
			<
			/div> <
			div classname = "flex justify-end gap-2 pt-3 border-t mt-4" >
			<
			button type = "button"
			onclick = {
				() => seteditpaymentmodal(null)
			}
			classname = "px-4 py-2 bg-slate-100 text-slate-700 rounded-lg" >
			إلغاء <
			/button> <
			button type = "button"
			onclick = {
				() => deletepayment(editpaymentmodal.row, editpaymentmodal.month)
			}
			classname = "px-4 py-2 bg-red-600 text-white rounded-lg" > 🗑️حذف القسط <
			/button> <
			button type = "submit"
			classname = "px-4 py-2 bg-blue-600 text-white rounded-lg font-bold" >
			حفظ التعديل <
			/button> < /
			div > <
			/form> < / >
		)
	} <
	/modal> < /
div >
);
// }
