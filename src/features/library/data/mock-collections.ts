import type { CollectionDeck, CategoryFilter } from '../types'

export const mockCategories: CategoryFilter[] = [
  { id: 'all', label: 'Tất cả tác phẩm' },
  {
    id: 'isekai',
    label: 'Isekai & Xuyên Không',
    count: 14820,
    avatar: '/mock-images/ln_1.png',
  },
  {
    id: 'romcom',
    label: 'Rom-Com & Học Đường',
    count: 9630,
    avatar: '/mock-images/ln_2.png',
  },
  {
    id: 'fantasy',
    label: 'Fantasy & Kỳ Ảo',
    count: 12450,
    avatar: '/mock-images/ln_3.jpg',
  },
  {
    id: 'action',
    label: 'Hành Động & Kiếm Thuật',
    count: 8750,
    avatar: '/mock-images/ln_4.png',
  },
  {
    id: 'scifi',
    label: 'Sci-Fi & Viễn Tưởng',
    count: 5120,
    avatar: '/mock-images/ln_5.png',
  },
  {
    id: 'mystery',
    label: 'Bí Ẩn & Siêu Nhiên',
    count: 4380,
    avatar: '/mock-images/ln_6.png',
  },
  {
    id: 'dark',
    label: 'Dark Fantasy & Bá Đạo',
    count: 3890,
    avatar: '/mock-images/ln_7.png',
  },
  {
    id: 'psychological',
    label: 'Tâm Lý & Vòng Lặp',
    count: 3410,
    avatar: '/mock-images/ln_8.png',
  },
  {
    id: 'sliceoflife',
    label: 'Đời Thường & Chữa Lành',
    count: 2950,
    avatar: '/mock-images/ln_9.png',
  },
  {
    id: 'harem',
    label: 'Harem & Đấu Trí',
    count: 6240,
    avatar: '/mock-images/ln_10.png',
  },
  {
    id: 'game',
    label: 'Thế Giới Game & VR',
    count: 4180,
    avatar: '/mock-images/ln_11.png',
  },
]

export const mockCollections: CollectionDeck[] = [
  {
    "id": "ln-mushoku",
    "title": "Mushoku Tensei: Thất Nghiệp Chuyển Sinh",
    "category": "isekai",
    "itemCount": 26,
    "totalFiles": 342,
    "newCount": 18,
    "tags": [
      "Isekai",
      "Kỳ Ảo",
      "Phiêu Lưu",
      "Phép Thuật"
    ],
    "ambientColors": [
      "#3b82f6",
      "#60a5fa",
      "#8b5cf6"
    ],
    "covers": [
      "/mock-images/ln_12.png",
      "/mock-images/ln_13.jpg",
      "/mock-images/ln_14.png"
    ],
    "illustrations": [
      "/mock-images/ln_13.jpg",
      "/mock-images/ln_12.png",
      "/mock-images/ln_14.png",
      "/mock-images/ln_15.png",
      "/mock-images/ln_16.png",
      "/mock-images/ln_17.png"
    ]
  },
  {
    "id": "ln-rezero",
    "title": "Re:Zero − Bắt Đầu Lại Ở Thế Giới Khác",
    "category": "isekai",
    "itemCount": 35,
    "totalFiles": 486,
    "newCount": 24,
    "tags": [
      "Isekai",
      "Vòng Lặp",
      "Tâm Lý",
      "Bi Kịch"
    ],
    "ambientColors": [
      "#8b5cf6",
      "#ec4899",
      "#3b82f6"
    ],
    "covers": [
      "/mock-images/ln_18.jpg",
      "/mock-images/ln_19.jpg",
      "/mock-images/ln_8.png"
    ],
    "illustrations": [
      "/mock-images/ln_19.jpg",
      "/mock-images/ln_18.jpg",
      "/mock-images/ln_8.png",
      "/mock-images/ln_20.jpg",
      "/mock-images/ln_1.png",
      "/mock-images/ln_21.png"
    ]
  },
  {
    "id": "ln-cote",
    "title": "Classroom of the Elite: Lớp Học Thực Lực",
    "category": "romcom",
    "itemCount": 28,
    "totalFiles": 390,
    "newCount": 15,
    "tags": [
      "Học Đường",
      "Tâm Lý",
      "Đấu Trí",
      "Harem"
    ],
    "ambientColors": [
      "#ef4444",
      "#f97316",
      "#eab308"
    ],
    "covers": [
      "/mock-images/ln_10.png",
      "/mock-images/ln_22.jpg",
      "/mock-images/ln_23.png"
    ],
    "illustrations": [
      "/mock-images/ln_22.jpg",
      "/mock-images/ln_10.png",
      "/mock-images/ln_23.png",
      "/mock-images/ln_24.png",
      "/mock-images/ln_25.jpg",
      "/mock-images/ln_26.png"
    ]
  },
  {
    "id": "ln-86",
    "title": "86 - Eighty Six: Chiến Trường Khắc Nghiệt",
    "category": "scifi",
    "itemCount": 13,
    "totalFiles": 215,
    "newCount": 9,
    "tags": [
      "Mecha",
      "Viễn Tưởng",
      "Chiến Tranh",
      "Tình Cảm"
    ],
    "ambientColors": [
      "#06b6d4",
      "#3b82f6",
      "#6366f1"
    ],
    "covers": [
      "/mock-images/ln_27.png",
      "/mock-images/ln_28.jpg",
      "/mock-images/ln_5.png"
    ],
    "illustrations": [
      "/mock-images/ln_28.jpg",
      "/mock-images/ln_27.png",
      "/mock-images/ln_5.png",
      "/mock-images/ln_29.png",
      "/mock-images/ln_30.jpg",
      "/mock-images/ln_31.jpg"
    ]
  },
  {
    "id": "ln-oregairu",
    "title": "Oregairu: Chuyện Tình Thanh Xuân Bi Hài",
    "category": "romcom",
    "itemCount": 18,
    "totalFiles": 280,
    "newCount": 6,
    "tags": [
      "Rom-Com",
      "Học Đường",
      "Đời Thường",
      "Triết Lý"
    ],
    "ambientColors": [
      "#10b981",
      "#14b8a6",
      "#0ea5e9"
    ],
    "covers": [
      "/mock-images/ln_32.png",
      "/mock-images/ln_33.jpg",
      "/mock-images/ln_2.png"
    ],
    "illustrations": [
      "/mock-images/ln_33.jpg",
      "/mock-images/ln_32.png",
      "/mock-images/ln_2.png",
      "/mock-images/ln_34.png",
      "/mock-images/ln_35.jpg",
      "/mock-images/ln_36.png"
    ]
  },
  {
    "id": "ln-apothecary",
    "title": "Dược Sư Tự Sự: Bí Ẩn Cung Đình",
    "category": "mystery",
    "itemCount": 15,
    "totalFiles": 230,
    "newCount": 12,
    "tags": [
      "Cổ Trang",
      "Phá Án",
      "Y Học",
      "Cung Đình"
    ],
    "ambientColors": [
      "#10b981",
      "#eab308",
      "#f59e0b"
    ],
    "covers": [
      "/mock-images/ln_6.png",
      "/mock-images/ln_37.jpg",
      "/mock-images/ln_38.jpg"
    ],
    "illustrations": [
      "/mock-images/ln_37.jpg",
      "/mock-images/ln_6.png",
      "/mock-images/ln_38.jpg",
      "/mock-images/ln_39.jpg",
      "/mock-images/ln_40.jpg",
      "/mock-images/ln_41.jpg"
    ]
  },
  {
    "id": "ln-slime",
    "title": "Tensura: Chuyển Sinh Thành Slime",
    "category": "isekai",
    "itemCount": 21,
    "totalFiles": 365,
    "newCount": 22,
    "tags": [
      "Isekai",
      "Xây Dựng Vương Quốc",
      "Hài Hước",
      "Quái Vật"
    ],
    "ambientColors": [
      "#0ea5e9",
      "#38bdf8",
      "#818cf8"
    ],
    "covers": [
      "/mock-images/ln_42.png",
      "/mock-images/ln_43.jpg",
      "/mock-images/ln_44.png"
    ],
    "illustrations": [
      "/mock-images/ln_43.jpg",
      "/mock-images/ln_42.png",
      "/mock-images/ln_44.png",
      "/mock-images/ln_45.png",
      "/mock-images/ln_46.png",
      "/mock-images/ln_47.png"
    ]
  },
  {
    "id": "ln-sao",
    "title": "Sword Art Online: Thế Giới Kiếm Ảo",
    "category": "scifi",
    "itemCount": 27,
    "totalFiles": 520,
    "newCount": 31,
    "tags": [
      "Thế Giới Ảo",
      "Kiếm Thuật",
      "Hành Động",
      "Tình Cảm"
    ],
    "ambientColors": [
      "#3b82f6",
      "#6366f1",
      "#a855f7"
    ],
    "covers": [
      "/mock-images/ln_4.png",
      "/mock-images/ln_48.jpg",
      "/mock-images/ln_11.png"
    ],
    "illustrations": [
      "/mock-images/ln_48.jpg",
      "/mock-images/ln_4.png",
      "/mock-images/ln_11.png",
      "/mock-images/ln_49.png",
      "/mock-images/ln_50.png",
      "/mock-images/ln_51.png"
    ]
  },
  {
    "id": "ln-spice-wolf",
    "title": "Sói Và Gia Vị: Hành Trình Thương Gia",
    "category": "fantasy",
    "itemCount": 24,
    "totalFiles": 310,
    "newCount": 5,
    "tags": [
      "Fantasy",
      "Kinh Tế",
      "Du Ngoạn",
      "Người Thú"
    ],
    "ambientColors": [
      "#f59e0b",
      "#d97706",
      "#b45309"
    ],
    "covers": [
      "/mock-images/ln_3.jpg",
      "/mock-images/ln_52.jpg",
      "/mock-images/ln_53.png"
    ],
    "illustrations": [
      "/mock-images/ln_52.jpg",
      "/mock-images/ln_3.jpg",
      "/mock-images/ln_53.png",
      "/mock-images/ln_54.png",
      "/mock-images/ln_55.png",
      "/mock-images/ln_56.png"
    ]
  },
  {
    "id": "ln-monogatari",
    "title": "Bakemonogatari: Quái Vật Truyện",
    "category": "mystery",
    "itemCount": 28,
    "totalFiles": 415,
    "newCount": 14,
    "tags": [
      "Siêu Nhiên",
      "Huyền Bí",
      "Đối Thoại",
      "Dị Nhân"
    ],
    "ambientColors": [
      "#dc2626",
      "#9333ea",
      "#db2777"
    ],
    "covers": [
      "/mock-images/ln_57.png",
      "/mock-images/ln_58.jpg",
      "/mock-images/ln_59.jpg"
    ],
    "illustrations": [
      "/mock-images/ln_58.jpg",
      "/mock-images/ln_57.png",
      "/mock-images/ln_59.jpg",
      "/mock-images/ln_60.jpg",
      "/mock-images/ln_61.png",
      "/mock-images/ln_62.jpg"
    ]
  },
  {
    "id": "ln-konosuba",
    "title": "KonoSuba: Mở Ra Thế Giới Tuyệt Vời!",
    "category": "isekai",
    "itemCount": 17,
    "totalFiles": 295,
    "newCount": 8,
    "tags": [
      "Isekai",
      "Hài Bựa",
      "Tổ Đội Thảm Họa",
      "Phép Thuật"
    ],
    "ambientColors": [
      "#38bdf8",
      "#fbbf24",
      "#f43f5e"
    ],
    "covers": [
      "/mock-images/ln_63.png",
      "/mock-images/ln_64.jpg",
      "/mock-images/ln_9.png"
    ],
    "illustrations": [
      "/mock-images/ln_64.jpg",
      "/mock-images/ln_63.png",
      "/mock-images/ln_9.png",
      "/mock-images/ln_65.png",
      "/mock-images/ln_66.png",
      "/mock-images/ln_67.png"
    ]
  },
  {
    "id": "ln-overlord",
    "title": "Overlord: Kẻ Thống Trị Lăng Mộ",
    "category": "isekai",
    "itemCount": 16,
    "totalFiles": 330,
    "newCount": 11,
    "tags": [
      "Isekai",
      "Bá Đạo",
      "Chiến Thuật",
      "Nhân Vật Phản Diện"
    ],
    "ambientColors": [
      "#7c3aed",
      "#4c1d95",
      "#1e1b4b"
    ],
    "covers": [
      "/mock-images/ln_7.png",
      "/mock-images/ln_68.png",
      "/mock-images/ln_69.png"
    ],
    "illustrations": [
      "/mock-images/ln_68.png",
      "/mock-images/ln_7.png",
      "/mock-images/ln_69.png",
      "/mock-images/ln_70.png",
      "/mock-images/ln_71.png",
      "/mock-images/ln_72.png"
    ]
  },
  {
    "id": "ln-zeroth-maria",
    "title": "Hộp Rỗng Và Maria Thứ 0",
    "category": "mystery",
    "itemCount": 7,
    "totalFiles": 145,
    "newCount": 3,
    "tags": [
      "Tâm Lý Tối Tăm",
      "Vòng Lặp",
      "Hồi Hộp",
      "Bí Ẩn"
    ],
    "ambientColors": [
      "#475569",
      "#64748b",
      "#94a3b8"
    ],
    "covers": [
      "/mock-images/ln_73.jpg",
      "/mock-images/ln_74.png",
      "/mock-images/ln_75.jpg"
    ],
    "illustrations": [
      "/mock-images/ln_74.png",
      "/mock-images/ln_73.jpg",
      "/mock-images/ln_75.jpg",
      "/mock-images/ln_76.jpg",
      "/mock-images/ln_77.png",
      "/mock-images/ln_78.png"
    ]
  },
  {
    "id": "ln-three-days",
    "title": "Ba Ngày Hạnh Phúc",
    "category": "romcom",
    "itemCount": 1,
    "totalFiles": 68,
    "tags": [
      "Đoản Thiên",
      "Ý Nghĩa Sống",
      "Tình Cảm",
      "Cảm Xúc"
    ],
    "ambientColors": [
      "#38bdf8",
      "#818cf8",
      "#c084fc"
    ],
    "covers": [
      "/mock-images/ln_79.jpg",
      "/mock-images/ln_80.jpg",
      "/mock-images/ln_81.jpg"
    ],
    "illustrations": [
      "/mock-images/ln_80.jpg",
      "/mock-images/ln_79.jpg",
      "/mock-images/ln_81.jpg",
      "/mock-images/ln_82.jpg"
    ]
  }
]
