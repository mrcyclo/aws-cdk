FROM amazonlinux:2

RUN amazon-linux-extras enable php7.4 epel && yum clean metadata

RUN yum install -y unzip curl httpd php php-common php-pgsql php-curl php-gd php-mbstring php-xmlrpc php-intl php-zlib php-bcmath php-xml && \
    yum clean all && \
    rm -rf /var/cache/yum

RUN echo " \
<VirtualHost *:80> \
	DocumentRoot /var/www/html/public \
	<Directory /var/www/html/public> \
		Order allow,deny \
		Allow from all \
		AllowOverride all \
	</Directory> \
</VirtualHost> \
" | tee /etc/httpd/conf.d/web.conf

RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/bin --filename=composer

WORKDIR /var/www/html

RUN composer create-project laravel/laravel . && \
    chown -R :apache /var/www/html && \
    chmod 2775 /var/www/html && \
    chown -R :apache storage && \
    chown -R :apache bootstrap/cache && \
    chgrp -R apache storage bootstrap/cache && \
    chmod -R ug+rwx storage bootstrap/cache

CMD [ "/usr/sbin/httpd", "-D", "FOREGROUND" ]
