import React from 'react';

// enrollment list
export default function EnrollmentList({ enrollments = [], onCancel, onDelete, showCancelAll, onCancelAll, bulkCancelling, bulkProgress, showHeader = true, disableRowClick = false }) {
  return (
    <div>
      {showHeader && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <h3 style={{ margin:0 }}>Enrolled users ({enrollments.length})</h3>
          {showCancelAll && (
            <div>
              <button onClick={onCancelAll} disabled={bulkCancelling || enrollments.length===0} style={{ padding:'8px 12px', background:'#ef4444', color:'white', border:'none', borderRadius:8, cursor: bulkCancelling? 'not-allowed':'pointer' }}>
                {bulkCancelling ? `Cancelling (${bulkProgress?.done || 0}/${bulkProgress?.total || 0})` : 'Cancel all enrollments'}
              </button>
            </div>
          )}
        </div>
      )}

      {enrollments.length === 0 ? (
        <p style={{ color:'#6b7280' }}>No users enrolled yet.</p>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', background:'white', boxShadow:'0 2px 8px rgba(0,0,0,0.05)', borderRadius:8, overflow:'hidden' }}>
            <thead style={{ background:'#f9fafb' }}>
              <tr style={{ borderBottom:'1px solid #e5e7eb' }}>
                <th style={{ padding:8, textAlign:'left' }}>Name</th>
                <th style={{ padding:8, textAlign:'left' }}>Email</th>
                <th style={{ padding:8, textAlign:'left' }}>Enrolled at</th>
                <th style={{ padding:8, width:240 }}></th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map(e => {
                const enrollmentId = e.enrollmentId ?? e.Id ?? e.id;
                const userObj = e.user || {};
                const userId = e.user?.id ?? e.user?.Id ?? e.userId ?? null;
                const firstName = e.firstName ?? userObj.firstName ?? userObj.FirstName ?? '';
                const lastName = e.lastName ?? userObj.lastName ?? userObj.LastName ?? '';
                const email = e.email ?? userObj.email ?? userObj.Email ?? '';
                const enrolledAt = e.enrolledAt ?? e.EnrolledAt ?? e.enrolledAtUtc ?? null;
                const status = (e.status ?? e.Status ?? 'Active');
                const rowClickable = !!userId && !disableRowClick;
                return (
                  <tr
                    key={enrollmentId}
                    style={{ borderTop:'1px solid #eef2f7', transition:'background .15s', cursor: rowClickable ? 'pointer' : 'default' }}
                    onClick={() => { if (rowClickable) window.location.href = `/admin/users/${userId}`; }}
                    onMouseOver={e => { e.currentTarget.style.background = '#f3f4f6'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding:8 }}>{firstName} {lastName}</td>
                    <td style={{ padding:8 }}>{email}</td>
                    <td style={{ padding:8 }}>{enrolledAt ? new Date(enrolledAt).toLocaleString() : ''}</td>
                    <td style={{ padding:8 }}>
                      <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
                        {onCancel && status.toLowerCase() === 'active' && (
                          <button onClick={(ev) => { ev.stopPropagation(); onCancel(enrollmentId); }} disabled={false} style={{ padding:'6px 10px', background:'#ef4444', color:'white', border:'none', borderRadius:6 }}>
                            Cancel enrollment
                          </button>
                        )}

                        {onDelete && (
                          <button onClick={(ev) => { ev.stopPropagation(); onDelete(enrollmentId); }} style={{ padding:'6px 10px', background:'#7f1d1d', color:'white', border:'none', borderRadius:6 }}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
