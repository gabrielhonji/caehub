// UTFPR Apucarana graduação, calendário resumido 2026; verificado em 17/10/2026.
export const academicCalendarSource='https://nuvem.utfpr.edu.br/index.php/s/ZBGU0lUymU0BIvS';
export function academicTerm(now=new Date()){
 const year=now.getFullYear(),semester=now.getMonth()>=6?2:1;
 const verified=year===2026;
 const dates=semester===1?(verified?['03-10','07-13']:['03-01','07-31']):(verified?['08-18','12-19']:['08-01','12-20']);
 return {term:`${year}/${semester}`,validFrom:`${year}-${dates[0]}`,validTo:`${year}-${dates[1]}`,verified};
}
