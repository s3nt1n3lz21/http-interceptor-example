import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpHeaders, HttpInterceptor, HttpResponse } from '@angular/common/http';
import { HttpRequest } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { HttpHandler } from '@angular/common/http';
import { HttpEvent } from '@angular/common/http';
// import { FacadeService } from '../service/facade.service';
import { catchError, filter, finalize, retry, switchMap, take, tap } from 'rxjs/operators';
import { ConsoleService } from './console.service';
import { NotificationService } from './notification.service';
import { request } from 'http';

@Injectable({
  providedIn: 'root'
})
export class InterceptorService implements HttpInterceptor {
  token: string;
  // We can cache API responses as we intercept them
  private cache = new Map<string, any>();
  private refreshTokenInProgress = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor(
    private consoleService: ConsoleService,
    private notificationService: NotificationService
    ) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    // We can add the users authorisation token to the header
    // for all apis that arent the login, password resetting, password forgot or user account activation apis
    if (!req.url.includes('/login') && !req.url.includes('/password/reset') && !req.url.includes('/password/forgot') && !req.url.includes('/user/activate')) {
      if (this.token) {
        const headersWithAuth = new HttpHeaders({
          'Authorization': `Bearer ${this.token}`,
        });

        req = req.clone({ headers: headersWithAuth });
      }

    } else {
      // Otherwise send the users login details
      req = req.clone({ withCredentials: true });
    }

    // Add the content-type header
    if (!req.headers.has('Content-Type')) {
      req = req.clone({
        headers: req.headers.set('Content-Type', 'application/json; charset=utf-8')
      });
    }

    // We can do some profiling and log the time taken for apis
    const started = Date.now();
    let httpSucceeded: string;

    // Return the cached GET request if there is one
    if (req.method == 'GET') {
      const cachedResponse = this.cache.get(req.url);
      if (cachedResponse) {
        return of(cachedResponse);
      }
    }

    // Start executing the request
    return <Observable<HttpEvent<any>>>next.handle(req).pipe(
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
          // Usually caused by an expired token
          // if (this.refreshTokenInProgress) {
          //   // If refreshTokenInProgress is true, we will wait until refreshTokenSubject has a non-null value
          //   // which means the new token is ready and we can retry the request again
          //   return this.refreshTokenSubject.pipe(
          //     filter(result => result !== null),
          //     take(1),
          //     // switchMap(() => next.handle(this.addAuthenticationToken(req)))
          //   );
          // } else {
          //   this.refreshTokenInProgress = true;

          //   // Set the refreshTokenSubject to null so that subsequent API calls will wait until the new token has been retrieved
          //   this.refreshTokenSubject.next(null);
            
          //   return this.refreshAccessToken().pipe(
          //     switchMap((success: boolean) => {               
          //       this.refreshTokenSubject.next(success);
          //       return next.handle(this.addAuthenticationToken(req));
          //     }),
          //     // When the call to refreshToken completes we reset the refreshTokenInProgress to false
          //     // for the next time the token needs to be refreshed
          //     finalize(() => this.refreshTokenInProgress = false)
          //   );
          // }

          this.notificationService.error('401 Error');
          break;
        case 500:
          this.notificationService.error('500 Error');
          break;
      }
    }

    private refreshAccessToken(): Observable<any> {
      return of("secret token");
    }
}