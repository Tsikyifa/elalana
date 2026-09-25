elalana/
├── TPAPP/                         # BACKEND DJANGO
│   ├── manage.py
│   ├── requirements.txt
│   │
│   ├── TPAPP/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── asgi.py
│   │   └── wsgi.py
│   │
│   ├── apitp/
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   └── views.py
│   │
│   ├── travaux/
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── filters.py
│   │   ├── forms.py
│   │   ├── urls.py
│   │   └── views.py
│   │
│   ├── audience/
│   │   ├── models.py
│   │   ├── forms.py
│   │   ├── urls.py
│   │   └── views.py
│   │
│   └── om/
│       ├── models.py
│       ├── serializers.py
│       ├── urls.py
│       └── views.py
│
└── frontend/                     # FRONTEND REACT
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    │
    ├── public/
    │   └── ...
    │
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        │
        ├── assets/
        │   ├── images/
        │   ├── icons/
        │   └── logo/
        │
        ├── api/
        │   ├── client.ts
        │   ├── auth.api.ts
        │   ├── travaux.api.ts
        │   ├── audience.api.ts
        │   ├── om.api.ts
        │   └── apitp.api.ts
        │
        ├── types/
        │   ├── auth.ts
        │   ├── travaux.ts
        │   ├── audience.ts
        │   ├── om.ts
        │   └── api.ts
        │
        ├── components/
        │   ├── ui/
        │   │   ├── Button.tsx
        │   │   ├── Input.tsx
        │   │   ├── Modal.tsx
        │   │   ├── Table.tsx
        │   │   ├── Badge.tsx
        │   │   ├── Loader.tsx
        │   │   └── Pagination.tsx
        │   │
        │   ├── layout/
        │   │   ├── Sidebar.tsx
        │   │   ├── Header.tsx
        │   │   ├── Navbar.tsx
        │   │   └── Layout.tsx
        │   │
        │   └── common/
        │       ├── ConfirmDialog.tsx
        │       ├── SearchBar.tsx
        │       └── ErrorMessage.tsx
        │
        ├── pages/
        │   ├── auth/
        │   │   ├── Login.tsx
        │   │   └── ForgotPassword.tsx
        │   │
        │   ├── dashboard/
        │   │   └── Dashboard.tsx
        │   │
        │   ├── travaux/
        │   │   ├── TravauxList.tsx
        │   │   ├── TravauxDetail.tsx
        │   │   ├── TravauxCreate.tsx
        │   │   └── TravauxEdit.tsx
        │   │
        │   ├── audience/
        │   │   ├── AudienceList.tsx
        │   │   ├── AudienceDetail.tsx
        │   │   └── AudienceCreate.tsx
        │   │
        │   ├── om/
        │   │   ├── OMList.tsx
        │   │   ├── OMDetail.tsx
        │   │   └── OMCreate.tsx
        │   │
        │   └── reports/
        │       ├── Reports.tsx
        │       └── Exports.tsx
        │
        ├── routes/
        │   ├── AppRoutes.tsx
        │   ├── ProtectedRoute.tsx
        │   └── routeConfig.ts
        │
        ├── hooks/
        │   ├── useAuth.ts
        │   ├── useApi.ts
        │   └── usePagination.ts
        │
        ├── context/
        │   └── AuthContext.tsx
        │
        ├── stores/
        │   └── authStore.ts
        │
        ├── utils/
        │   ├── formatDate.ts
        │   ├── formatNumber.ts
        │   └── permissions.ts
        │
        └── styles/
            ├── variables.css
            └── components.css


