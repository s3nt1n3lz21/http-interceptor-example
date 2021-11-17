import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpHeaders, HttpInterceptor, HttpResponse } from '@angular/common/http';
import { HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { HttpHandler } from '@angular/common/http';
import { HttpEvent } from '@angular/common/http';
// import { FacadeService } from '../service/facade.service';
import { catchError, finalize, retry, tap } from 'rxjs/operators';
import { ConsoleService } from './console.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class InterceptorService implements HttpInterceptor {
  token: string;
  constructor(
    private consoleService: ConsoleService,
    private notificationService: NotificationService
    ) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    let newReq: HttpRequest<any>;

    // We can add the users authorisation token to the header
    // for all apis that arent the password resetting, password forgot or user account activation apis
    if (!req.url.includes('/password/reset') && !req.url.includes('/password/forgot') && !req.url.includes('/user/activate')) {
      const headersWithAuth = new HttpHeaders({
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json; charset=utf-8'
      });

      newReq = req.clone({ headers: headersWithAuth });
    } else {
      const headersNoAuth = new HttpHeaders({
        'Content-Type': 'application/json; charset=utf-8'
      });

      newReq = req.clone({ headers: headersNoAuth, withCredentials: true });
    }

    // We can do some profiling and log the time taken for apis
    const started = Date.now();
    let httpSucceeded: string;

    // Start executing the request
    return <Observable<HttpEvent<any>>>next.handle(newReq).pipe(
      // Retry the http call at least 1 more time before dealing with the error
      retry(2),
      tap(
        (event: HttpEvent<any>) => httpSucceeded = event instanceof HttpResponse ? 'succeeded' : '',
        (error: HttpErrorResponse) => httpSucceeded = "failed"
      ),
      // Do something on a successful call
      tap((event: HttpEvent<any>) => {
        if (event instanceof HttpResponse && event.status === 201) {
          this.notificationService.success("Object created.");
        }
      }),
      // Log the time taken for the api call
      finalize(() => {
        const elapsed = Date.now() - started;
        const msg = `${req.method} "${req.urlWithParams}" ${httpSucceeded} in ${elapsed} ms.`;
        this.consoleService.logHttp(msg);
      }),
      // Handle errors
      catchError(
        (error: HttpErrorResponse) => {
          this.httpError(error);
          return throwError(error)
        }
      ))
    };

    // Handle different status code errors
    httpError(error: HttpErrorResponse) {
      switch (error.status) {
        case 204:
          this.notificationService.error('204 Error');
          break;
        case 400:
          this.notificationService.error('400 Error');
          break;
        case 401:
          this.notificationService.error('401 Error');
          break;
        case 500:
          this.notificationService.error('500 Error');
          break;
      }
    }

    // We can use the interceptor to modify all the headers
    // const modified = req.clone({ 
    //   setHeaders: { "X-Man": "Wolverine" } 
    // });

    // this.token = this.facadeService.getUserToken();
    // if (this.token) {
    //   const tokenizedReq = req.clone({ headers: req.headers.set('Authorization', 'Bearer ' + this.token) });
    //   return next.handle(tokenizedReq);
    // }
    // return next.handle(req);
}