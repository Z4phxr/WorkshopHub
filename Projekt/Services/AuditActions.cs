namespace Projekt.Services
{
    public static class AuditActions
    {
        // user actions
        public const string USER_REGISTERED = nameof(USER_REGISTERED);
        public const string USER_LOGGED_IN = nameof(USER_LOGGED_IN);
        public const string USER_LOGGED_OUT = nameof(USER_LOGGED_OUT);
        public const string USER_PASSWORD_CHANGED = nameof(USER_PASSWORD_CHANGED);
        public const string USER_CREATED = nameof(USER_CREATED);
        public const string USER_UPDATED = nameof(USER_UPDATED);
        public const string USER_DELETED = nameof(USER_DELETED);
        
        // role actions
        public const string ROLE_ASSIGNED = nameof(ROLE_ASSIGNED);
        public const string ROLE_REMOVED = nameof(ROLE_REMOVED);
        
        // enrollment actions
        public const string ENROLLMENT_CREATED = nameof(ENROLLMENT_CREATED);
        public const string ENROLLED_IN_CYCLE = nameof(ENROLLED_IN_CYCLE);
        public const string ENROLLMENT_CANCELLED = nameof(ENROLLMENT_CANCELLED);
        public const string MY_ENROLLMENT_CANCELLED = nameof(MY_ENROLLMENT_CANCELLED);
        public const string ENROLLMENT_DELETED = nameof(ENROLLMENT_DELETED);
        
        // payment actions
        public const string PAYMENT_CREATED = nameof(PAYMENT_CREATED);
        public const string PAYMENT_UPDATED = nameof(PAYMENT_UPDATED);
        public const string PAYMENT_MARKED_PAID = nameof(PAYMENT_MARKED_PAID);
        public const string PAYMENT_DELETED = nameof(PAYMENT_DELETED);
        
        // workshop actions
        public const string WORKSHOP_CREATED = nameof(WORKSHOP_CREATED);
        public const string WORKSHOP_UPDATED = nameof(WORKSHOP_UPDATED);
        public const string WORKSHOP_DELETED = nameof(WORKSHOP_DELETED);
        public const string WORKSHOP_IMAGE_UPLOADED = nameof(WORKSHOP_IMAGE_UPLOADED);
        public const string PHOTO_EDITED = nameof(PHOTO_EDITED);
        
        // cycle actions
        public const string CYCLE_CREATED = nameof(CYCLE_CREATED);
        public const string CYCLE_UPDATED = nameof(CYCLE_UPDATED);
        public const string CYCLE_DELETED = nameof(CYCLE_DELETED);
        public const string CYCLE_ENROLLMENTS_CANCELLED = nameof(CYCLE_ENROLLMENTS_CANCELLED);
        
        // ssession actions
        public const string SESSION_CREATED = nameof(SESSION_CREATED);
        public const string SESSION_UPDATED = nameof(SESSION_UPDATED);
        public const string SESSION_DELETED = nameof(SESSION_DELETED);
        
        // address actions
        public const string ADDRESS_CREATED = nameof(ADDRESS_CREATED);
        public const string ADDRESS_UPDATED = nameof(ADDRESS_UPDATED);
        public const string ADDRESS_DELETED = nameof(ADDRESS_DELETED);
        
        // category actions
        public const string CATEGORY_CREATED = nameof(CATEGORY_CREATED);
        public const string CATEGORY_UPDATED = nameof(CATEGORY_UPDATED);
        public const string CATEGORY_DELETED = nameof(CATEGORY_DELETED);
        
        // review actions
        public const string REVIEW_CREATED = nameof(REVIEW_CREATED);
        public const string REVIEW_UPDATED = nameof(REVIEW_UPDATED);
        public const string REVIEW_DELETED = nameof(REVIEW_DELETED);
        
        // error actions
        public const string ERROR_UNHANDLED = nameof(ERROR_UNHANDLED);
        public const string ERROR_DATABASE = nameof(ERROR_DATABASE);
        public const string ERROR_VALIDATION = nameof(ERROR_VALIDATION);
    }
}
